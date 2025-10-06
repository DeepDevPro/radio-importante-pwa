// Temporary Workspace Management for HLS Generation
// R4-2: Create and validate temporary workspace directory

const fs = require('fs');
const path = require('path');

/**
 * Creates and validates temporary workspace directory
 * @returns {Promise<{success: boolean, workspaceDir: string|null, error?: string, freeSpaceBytes?: number}>}
 */
async function createTempWorkspace() {
  const timestamp = Date.now();
  const workspaceDir = `/tmp/hls-work/latest-${timestamp}`;
  
  const result = {
    success: false,
    workspaceDir: null,
    error: null,
    freeSpaceBytes: null
  };

  try {
    // Ensure parent directory exists
    const parentDir = '/tmp/hls-work';
    await fs.promises.mkdir(parentDir, { recursive: true });
    
    // Create workspace directory
    await fs.promises.mkdir(workspaceDir, { recursive: true });
    
    // Validate permissions by creating a test file
    const testFile = path.join(workspaceDir, 'test-write.tmp');
    await fs.promises.writeFile(testFile, 'test', 'utf8');
    await fs.promises.unlink(testFile);
    
    // Try to get free space (best effort - may not work on all systems)
    let freeSpaceBytes = null;
    try {
      const stats = await fs.promises.statfs(workspaceDir);
      freeSpaceBytes = stats.bavail * stats.bsize; // Available bytes
    } catch (statfsError) {
      // statfs may not be available on all systems, continue without it
      console.log('[TempWorkspace] Could not get free space info:', statfsError.message);
    }
    
    result.success = true;
    result.workspaceDir = workspaceDir;
    result.freeSpaceBytes = freeSpaceBytes;
    
    console.log(`[TempWorkspace] Created: ${workspaceDir}, free space: ${freeSpaceBytes ? `${Math.round(freeSpaceBytes / 1024 / 1024)}MB` : 'unknown'}`);
    
  } catch (error) {
    result.error = error.message;
    console.log('[TempWorkspace] Creation failed:', error.message);
    
    // Clean up if partially created
    try {
      if (workspaceDir) {
        await fs.promises.rmdir(workspaceDir, { recursive: true });
      }
    } catch (cleanupError) {
      // Best effort cleanup
    }
  }

  return result;
}

/**
 * Cleans up temporary workspace directory
 * @param {string} workspaceDir - Directory to clean up
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function cleanupTempWorkspace(workspaceDir) {
  const result = {
    success: false,
    error: null
  };

  try {
    if (!workspaceDir || !workspaceDir.includes('/tmp/hls-work/')) {
      throw new Error('Invalid workspace directory for cleanup');
    }
    
    await fs.promises.rmdir(workspaceDir, { recursive: true });
    result.success = true;
    
    console.log(`[TempWorkspace] Cleaned up: ${workspaceDir}`);
    
  } catch (error) {
    result.error = error.message;
    console.log('[TempWorkspace] Cleanup failed:', error.message);
  }

  return result;
}

/**
 * Lists all temporary workspaces (for debugging/cleanup)
 * @returns {Promise<string[]>}
 */
async function listTempWorkspaces() {
  try {
    const parentDir = '/tmp/hls-work';
    const entries = await fs.promises.readdir(parentDir);
    return entries.filter(entry => entry.startsWith('latest-'));
  } catch (error) {
    return [];
  }
}

module.exports = {
  createTempWorkspace,
  cleanupTempWorkspace,
  listTempWorkspaces
};
