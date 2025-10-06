/**
 * R6-9: Debug UI Integration
 * 
 * Sistema de cache em memória para diagnostics e hypothesis data
 * com TTL para evitar locks e fornecer acesso rápido para Admin UI
 */

/* eslint-env node */
/* global setInterval, console, module */

class DebugDataCache {
  constructor() {
    this.cache = {
      diagnostics: {
        latest: null,
        rolling: null,
        lastUpdated: null
      },
      hypothesis: {
        safari: null,
        general: null,
        lastUpdated: null
      }
    };
    
    // TTL configuration (in milliseconds)
    this.ttl = {
      diagnostics: 5 * 60 * 1000, // 5 minutes
      hypothesis: 15 * 60 * 1000   // 15 minutes
    };
    
    // Auto-cleanup expired data every minute
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * Update diagnostics data for a specific mode
   */
  updateDiagnostics(mode, data) {
    if (!this.cache.diagnostics[mode]) {
      this.cache.diagnostics[mode] = {};
    }
    
    this.cache.diagnostics[mode] = {
      ...data,
      timestamp: Date.now(),
      mode
    };
    
    this.cache.diagnostics.lastUpdated = Date.now();
  }

  /**
   * Update hypothesis data
   */
  updateHypothesis(type, data) {
    if (!this.cache.hypothesis[type]) {
      this.cache.hypothesis[type] = {};
    }
    
    this.cache.hypothesis[type] = {
      ...data,
      timestamp: Date.now(),
      type
    };
    
    this.cache.hypothesis.lastUpdated = Date.now();
  }

  /**
   * Get diagnostics data (with freshness check)
   */
  getDiagnostics(mode = null) {
    const now = Date.now();
    
    if (mode) {
      const data = this.cache.diagnostics[mode];
      if (!data || (now - data.timestamp) > this.ttl.diagnostics) {
        return null; // Expired or missing
      }
      return this.sanitizeForUI(data);
    }
    
    // Return all available diagnostics
    const result = {};
    for (const [key, value] of Object.entries(this.cache.diagnostics)) {
      if (key !== 'lastUpdated' && value && (now - value.timestamp) <= this.ttl.diagnostics) {
        result[key] = this.sanitizeForUI(value);
      }
    }
    
    return Object.keys(result).length > 0 ? result : null;
  }

  /**
   * Get hypothesis data (with freshness check)
   */
  getHypothesis(type = null) {
    const now = Date.now();
    
    if (type) {
      const data = this.cache.hypothesis[type];
      if (!data || (now - data.timestamp) > this.ttl.hypothesis) {
        return null; // Expired or missing
      }
      return this.sanitizeForUI(data);
    }
    
    // Return all available hypothesis
    const result = {};
    for (const [key, value] of Object.entries(this.cache.hypothesis)) {
      if (key !== 'lastUpdated' && value && (now - value.timestamp) <= this.ttl.hypothesis) {
        result[key] = this.sanitizeForUI(value);
      }
    }
    
    return Object.keys(result).length > 0 ? result : null;
  }

  /**
   * Sanitize data for UI consumption (remove sensitive info, reduce size)
   */
  sanitizeForUI(data) {
    if (!data) return null;
    
    const sanitized = {
      timestamp: data.timestamp,
      mode: data.mode,
      type: data.type
    };

    // For diagnostics data
    if (data.status) {
      sanitized.status = data.status;
      sanitized.declaredCount = data.declaredCount;
      sanitized.headOkCount = data.headOkCount;
      sanitized.totalDurationApprox = data.totalDurationApprox;
      sanitized.averageExtinf = data.averageExtinf;
      
      // Performance summary
      if (data.timings && data.timings.length > 0) {
        sanitized.performance = {
          avgTiming: Math.round(data.timings.reduce((a, b) => a + b, 0) / data.timings.length),
          maxTiming: Math.max(...data.timings),
          minTiming: Math.min(...data.timings)
        };
      }
      
      // Health indicator
      sanitized.health = this.calculateHealthIndicator(data);
    }

    // For hypothesis data
    if (data.hypothesis) {
      sanitized.hypothesis = data.hypothesis;
      sanitized.confidence = data.confidence;
      sanitized.evidence = data.evidence;
      sanitized.recommendations = data.recommendations;
    }

    // General analysis
    if (data.analysis) {
      sanitized.analysis = data.analysis;
    }

    return sanitized;
  }

  /**
   * Calculate simple health indicator
   */
  calculateHealthIndicator(data) {
    if (!data.status) return 'unknown';
    
    if (data.status === 'ok' && data.headOkCount >= data.declaredCount) {
      return 'excellent';
    } else if (data.status === 'ok' && data.headOkCount >= (data.declaredCount * 0.8)) {
      return 'good';
    } else if (data.status === 'partial') {
      return 'warning';
    } else {
      return 'critical';
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    
    return {
      diagnostics: {
        available: Object.keys(this.cache.diagnostics).filter(k => 
          k !== 'lastUpdated' && this.cache.diagnostics[k] && 
          (now - this.cache.diagnostics[k].timestamp) <= this.ttl.diagnostics
        ),
        lastUpdated: this.cache.diagnostics.lastUpdated,
        ttl: this.ttl.diagnostics
      },
      hypothesis: {
        available: Object.keys(this.cache.hypothesis).filter(k => 
          k !== 'lastUpdated' && this.cache.hypothesis[k] && 
          (now - this.cache.hypothesis[k].timestamp) <= this.ttl.hypothesis
        ),
        lastUpdated: this.cache.hypothesis.lastUpdated,
        ttl: this.ttl.hypothesis
      },
      memory: {
        cacheSize: JSON.stringify(this.cache).length,
        timestamp: now
      }
    };
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    // Clean diagnostics
    for (const [key, value] of Object.entries(this.cache.diagnostics)) {
      if (key !== 'lastUpdated' && value && (now - value.timestamp) > this.ttl.diagnostics) {
        delete this.cache.diagnostics[key];
        cleaned++;
      }
    }
    
    // Clean hypothesis
    for (const [key, value] of Object.entries(this.cache.hypothesis)) {
      if (key !== 'lastUpdated' && value && (now - value.timestamp) > this.ttl.hypothesis) {
        delete this.cache.hypothesis[key];
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`[DebugDataCache] Cleaned ${cleaned} expired entries`);
    }
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache = {
      diagnostics: {
        latest: null,
        rolling: null,
        lastUpdated: null
      },
      hypothesis: {
        safari: null,
        general: null,
        lastUpdated: null
      }
    };
  }
}

// Singleton instance
const debugDataCache = new DebugDataCache();

module.exports = {
  DebugDataCache,
  debugDataCache
};
