/* eslint-env node */
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

// Configure Digital Ocean Spaces (reusing existing config pattern)
const spacesEndpoint = new AWS.Endpoint(process.env.DO_SPACES_ENDPOINT || 'nyc3.digitaloceanspaces.com');
const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: process.env.DO_SPACES_KEY,
  secretAccessKey: process.env.DO_SPACES_SECRET,
  region: process.env.DO_SPACES_REGION || 'nyc3'
});

/**
 * Upload a single file to Spaces with appropriate headers
 * @param {string} localFilePath - Path to local file
 * @param {string} spacesKey - Key (path) in Spaces bucket
 * @param {object} headers - Additional headers
 * @returns {Promise<boolean>} Success status
 */
async function uploadFile(localFilePath, spacesKey, headers = {}) {
  try {
    const fileContent = await fs.promises.readFile(localFilePath);
    const bucket = process.env.DO_SPACES_BUCKET || 'radio-importante-audio';
    
    const uploadParams = {
      Bucket: bucket,
      Key: spacesKey,
      Body: fileContent,
      ACL: 'public-read',
      ...headers
    };

    await s3.upload(uploadParams).promise();
    console.log(`[UploadHLS] Uploaded: ${spacesKey}`);
    return true;
  } catch (error) {
    console.error(`[UploadHLS] Upload failed for ${spacesKey}:`, error.message);
    return false;
  }
}

/**
 * Upload HLS files sequentially with proper headers
 * Implements R4-7: segments first, playlist last for atomicity
 * @param {string} workspaceDir - Local directory containing HLS files
 * @param {string} targetPrefix - Target path prefix (e.g., 'generated/hls/latest/')
 * @returns {Promise<{success: boolean, segmentCount: number, uploadDurationMs: number, error?: string}>}
 */
async function uploadHlsFiles(workspaceDir, targetPrefix = 'generated/hls/latest/') {
  const startTime = Date.now();
  const result = {
    success: false,
    segmentCount: 0,
    uploadDurationMs: 0,
    error: null
  };

  try {
    // Read directory contents
    const files = await fs.promises.readdir(workspaceDir);
    
    // Separate playlist and segment files
    const playlistFiles = files.filter(f => f.endsWith('.m3u8'));
    const segmentFiles = files.filter(f => f.endsWith('.ts')).sort();
    
    if (playlistFiles.length === 0) {
      throw new Error('No playlist file found');
    }
    
    if (segmentFiles.length === 0) {
      throw new Error('No segment files found');
    }

    console.log(`[UploadHLS] Starting upload: ${segmentFiles.length} segments + ${playlistFiles.length} playlists`);

    // R4-8 ATOMICITY: Upload segments first
    let uploadedSegments = 0;
    for (const segmentFile of segmentFiles) {
      const localPath = path.join(workspaceDir, segmentFile);
      const spacesKey = targetPrefix + segmentFile;
      
      // Segment headers: long cache
      const segmentHeaders = {
        CacheControl: 'public, max-age=86400',
        ContentType: 'video/mp2t'
      };
      
      const success = await uploadFile(localPath, spacesKey, segmentHeaders);
      if (!success) {
        throw new Error(`Failed to upload segment: ${segmentFile}`);
      }
      uploadedSegments++;
    }

    result.segmentCount = uploadedSegments;

    // Upload playlist last (atomic switch)
    for (const playlistFile of playlistFiles) {
      const localPath = path.join(workspaceDir, playlistFile);
      const spacesKey = targetPrefix + playlistFile;
      
      // Playlist headers: no-cache
      const playlistHeaders = {
        CacheControl: 'no-cache, no-store, must-revalidate',
        ContentType: 'application/vnd.apple.mpegurl'
      };
      
      const success = await uploadFile(localPath, spacesKey, playlistHeaders);
      if (!success) {
        throw new Error(`Failed to upload playlist: ${playlistFile}`);
      }
    }

    result.uploadDurationMs = Date.now() - startTime;
    result.success = true;
    
    console.log(`[UploadHLS] Upload complete: ${result.segmentCount} segments in ${result.uploadDurationMs}ms`);

  } catch (error) {
    result.error = error.message;
    result.uploadDurationMs = Date.now() - startTime;
    console.error('[UploadHLS] Upload failed:', error.message);
    
    // R4-8: If partial upload, attempt cleanup (best-effort)
    if (result.segmentCount > 0) {
      console.log(`[UploadHLS] Partial upload detected, attempting cleanup of ${result.segmentCount} segments`);
      // Note: Actual cleanup would need additional implementation
      // For now, just log the partial upload flag
      result.partialUpload = true;
    }
  }

  return result;
}

module.exports = {
  uploadHlsFiles
};
