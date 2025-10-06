/* eslint-env node */
// R5-0: Test script to validate saveAutoLog parameter normalization
// Run this to ensure both call patterns work correctly

const { saveAutoLog } = require('./state/hlsState');

console.log('=== R5-0: Testing saveAutoLog parameter normalization ===\n');

// Test pattern 1: (message, type)
console.log('Test 1: saveAutoLog("Capability check completed", "HLS_GEN")');
saveAutoLog("Capability check completed", "HLS_GEN");

// Test pattern 2: (type, message) - problematic pattern from R4
console.log('\nTest 2: saveAutoLog("HLS_GEN", "Starting real generation")');
saveAutoLog("HLS_GEN", "Starting real generation");

// Test pattern 3: default type
console.log('\nTest 3: saveAutoLog("Default info message")');
saveAutoLog("Default info message");

// Test pattern 4: edge cases
console.log('\nTest 4: saveAutoLog("HLS_PROXY", "Proxy request handled")');
saveAutoLog("HLS_PROXY", "Proxy request handled");

console.log('\nTest 5: saveAutoLog("Upload complete", "HLS_DIAG")');
saveAutoLog("Upload complete", "HLS_DIAG");

// Test pattern 6: unknown type
console.log('\nTest 6: saveAutoLog("Custom message", "custom_type")');
saveAutoLog("Custom message", "custom_type");

console.log('\n=== All tests completed - check output format ===');
