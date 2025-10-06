/**
 * R6-6: Janitor Inteligente para /tmp/hls-work/*
 * 
 * Funcionalidades:
 * 1. Remover diretórios concluídos após sucesso
 * 2. Varrer diretórios órfãos >24h e deletar
 * 3. Métricas: total freed bytes + count removidos
 * 4. Logging com prefixo HLS_GEN tipo 'janitor'
 */

/* eslint-env node */
/* eslint-disable no-unused-vars, no-undef */

const fs = require('fs').promises;
const path = require('path');
const { saveAutoLog } = require('../state/hlsState');

const TEMP_BASE_DIR = '/tmp/hls-work';
const ORPHAN_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get directory size recursively
 */
async function getDirectorySize(dirPath) {
  try {
    const stats = await fs.stat(dirPath);
    if (!stats.isDirectory()) {
      return stats.size;
    }

    const files = await fs.readdir(dirPath);
    let totalSize = 0;

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      try {
        const fileStats = await fs.stat(filePath);
        if (fileStats.isDirectory()) {
          totalSize += await getDirectorySize(filePath);
        } else {
          totalSize += fileStats.size;
        }
      } catch (error) {
        // Skip files that can't be accessed
        continue;
      }
    }

    return totalSize;
  } catch (error) {
    return 0;
  }
}

/**
 * Remove directory recursively
 */
async function removeDirectory(dirPath) {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
    return true;
  } catch (error) {
    await saveAutoLog(`[Janitor] Failed to remove ${dirPath}: ${error.message}`, 'HLS_GEN');
    return false;
  }
}

/**
 * Check if directory is empty or contains only empty subdirectories
 */
async function isDirectoryEmpty(dirPath) {
  try {
    const files = await fs.readdir(dirPath);
    if (files.length === 0) return true;

    // Check if all subdirectories are empty
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = await fs.stat(filePath);
      
      if (stats.isFile()) {
        return false; // Has files
      } else if (stats.isDirectory()) {
        const isEmpty = await isDirectoryEmpty(filePath);
        if (!isEmpty) return false;
      }
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get orphaned directories (>24h old)
 */
async function getOrphanedDirectories() {
  try {
    // Ensure base directory exists
    try {
      await fs.access(TEMP_BASE_DIR);
    } catch {
      // Directory doesn't exist, no orphans
      return [];
    }

    const entries = await fs.readdir(TEMP_BASE_DIR, { withFileTypes: true });
    const orphans = [];
    const now = Date.now();

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const dirPath = path.join(TEMP_BASE_DIR, entry.name);
      try {
        const stats = await fs.stat(dirPath);
        const ageMs = now - stats.mtime.getTime();

        if (ageMs > ORPHAN_THRESHOLD_MS) {
          orphans.push({
            path: dirPath,
            name: entry.name,
            ageMs,
            ageHours: Math.round(ageMs / (60 * 60 * 1000)),
            mtime: stats.mtime,
            size: await getDirectorySize(dirPath)
          });
        }
      } catch (error) {
        // Skip directories that can't be accessed
        continue;
      }
    }

    return orphans;
  } catch (error) {
    await saveAutoLog(`[Janitor] Error scanning for orphans: ${error.message}`, 'HLS_GEN');
    return [];
  }
}

/**
 * Clean completed directories (empty or marked as completed)
 */
async function cleanCompletedDirectories() {
  try {
    // Ensure base directory exists
    try {
      await fs.access(TEMP_BASE_DIR);
    } catch {
      return { removed: 0, freedBytes: 0, directories: [] };
    }

    const entries = await fs.readdir(TEMP_BASE_DIR, { withFileTypes: true });
    const results = {
      removed: 0,
      freedBytes: 0,
      directories: []
    };

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const dirPath = path.join(TEMP_BASE_DIR, entry.name);
      const dirName = entry.name;
      
      try {
        // Check if directory is empty or completed
        const isEmpty = await isDirectoryEmpty(dirPath);
        const hasSuccessMarker = await fs.access(path.join(dirPath, '.completed')).then(() => true).catch(() => false);
        
        if (isEmpty || hasSuccessMarker) {
          const size = await getDirectorySize(dirPath);
          const removed = await removeDirectory(dirPath);
          
          if (removed) {
            results.removed++;
            results.freedBytes += size;
            results.directories.push({
              name: dirName,
              path: dirPath,
              size,
              reason: isEmpty ? 'empty' : 'completed'
            });
          }
        }
      } catch (error) {
        // Skip problematic directories
        continue;
      }
    }

    return results;
  } catch (error) {
    await saveAutoLog(`[Janitor] Error cleaning completed directories: ${error.message}`, 'HLS_GEN');
    return { removed: 0, freedBytes: 0, directories: [] };
  }
}

/**
 * Clean orphaned directories (>24h old)
 */
async function cleanOrphanedDirectories() {
  const orphans = await getOrphanedDirectories();
  const results = {
    removed: 0,
    freedBytes: 0,
    directories: []
  };

  for (const orphan of orphans) {
    const removed = await removeDirectory(orphan.path);
    
    if (removed) {
      results.removed++;
      results.freedBytes += orphan.size;
      results.directories.push({
        name: orphan.name,
        path: orphan.path,
        size: orphan.size,
        ageHours: orphan.ageHours,
        reason: 'orphaned'
      });
    }
  }

  return results;
}

/**
 * Main janitor function
 */
async function runJanitor(options = {}) {
  const startTime = Date.now();
  const opts = {
    cleanCompleted: true,
    cleanOrphaned: true,
    dryRun: false,
    ...options
  };

  await saveAutoLog(`[Janitor] Starting cleanup (dryRun: ${opts.dryRun})`, 'HLS_GEN');

  const results = {
    totalRemoved: 0,
    totalFreedBytes: 0,
    completedResults: { removed: 0, freedBytes: 0, directories: [] },
    orphanedResults: { removed: 0, freedBytes: 0, directories: [] },
    durationMs: 0,
    dryRun: opts.dryRun
  };

  try {
    // Clean completed directories
    if (opts.cleanCompleted) {
      if (!opts.dryRun) {
        results.completedResults = await cleanCompletedDirectories();
      } else {
        // Dry run: scan but don't delete
        await saveAutoLog(`[Janitor] DRY RUN: Would clean completed directories`, 'HLS_GEN');
      }
    }

    // Clean orphaned directories
    if (opts.cleanOrphaned) {
      if (!opts.dryRun) {
        results.orphanedResults = await cleanOrphanedDirectories();
      } else {
        // Dry run: scan but don't delete
        const orphans = await getOrphanedDirectories();
        await saveAutoLog(`[Janitor] DRY RUN: Found ${orphans.length} orphaned directories`, 'HLS_GEN');
        results.orphanedResults = {
          removed: 0,
          freedBytes: orphans.reduce((sum, o) => sum + o.size, 0),
          directories: orphans.map(o => ({ ...o, reason: 'orphaned' }))
        };
      }
    }

    // Calculate totals
    results.totalRemoved = results.completedResults.removed + results.orphanedResults.removed;
    results.totalFreedBytes = results.completedResults.freedBytes + results.orphanedResults.freedBytes;
    results.durationMs = Date.now() - startTime;

    // Log summary
    const freedMB = Math.round(results.totalFreedBytes / 1024 / 1024);
    await saveAutoLog(
      `[Janitor] Cleanup complete: ${results.totalRemoved} directories removed, ${freedMB}MB freed (${results.durationMs}ms)`,
      'HLS_GEN'
    );

    // Log details if any cleanup was done
    if (results.totalRemoved > 0) {
      await saveAutoLog(
        `[Janitor] Completed: ${results.completedResults.removed}, Orphaned: ${results.orphanedResults.removed}`,
        'HLS_GEN'
      );
    }

    return results;
  } catch (error) {
    await saveAutoLog(`[Janitor] Fatal error: ${error.message}`, 'HLS_GEN');
    results.durationMs = Date.now() - startTime;
    results.error = error.message;
    return results;
  }
}

/**
 * Get janitor status and metrics
 */
async function getJanitorStatus() {
  try {
    const status = {
      tempBaseExists: false,
      totalDirectories: 0,
      totalSizeBytes: 0,
      orphanedDirectories: 0,
      orphanedSizeBytes: 0,
      oldestOrphanHours: 0
    };

    // Check if temp base directory exists
    try {
      await fs.access(TEMP_BASE_DIR);
      status.tempBaseExists = true;
    } catch {
      return status;
    }

    // Count directories and calculate sizes
    const entries = await fs.readdir(TEMP_BASE_DIR, { withFileTypes: true });
    const directories = entries.filter(e => e.isDirectory());
    status.totalDirectories = directories.length;

    let totalSize = 0;
    const orphans = await getOrphanedDirectories();
    
    for (const dir of directories) {
      const dirPath = path.join(TEMP_BASE_DIR, dir.name);
      const size = await getDirectorySize(dirPath);
      totalSize += size;
    }

    status.totalSizeBytes = totalSize;
    status.orphanedDirectories = orphans.length;
    status.orphanedSizeBytes = orphans.reduce((sum, o) => sum + o.size, 0);
    status.oldestOrphanHours = orphans.length > 0 ? Math.max(...orphans.map(o => o.ageHours)) : 0;

    return status;
  } catch (error) {
    return { error: error.message };
  }
}

module.exports = {
  runJanitor,
  getJanitorStatus,
  cleanCompletedDirectories,
  cleanOrphanedDirectories,
  getOrphanedDirectories,
  TEMP_BASE_DIR,
  ORPHAN_THRESHOLD_MS
};
