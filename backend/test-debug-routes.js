const express = require('express');

console.log('Loading debug routes...');

try {
  const debugRoutes = require('./routes/hlsDebug.routes');
  console.log('✅ Debug routes loaded successfully');
  console.log('Router methods:', Object.getOwnPropertyNames(debugRoutes));
} catch (error) {
  console.log('❌ Error loading debug routes:', error.message);
  console.log('Full error:', error);
}

try {
  const debugCache = require('./hls/debugDataCache');
  console.log('✅ Debug cache loaded successfully');
  console.log('Cache methods:', Object.keys(debugCache.debugDataCache));
} catch (error) {
  console.log('❌ Error loading debug cache:', error.message);
  console.log('Full error:', error);
}
