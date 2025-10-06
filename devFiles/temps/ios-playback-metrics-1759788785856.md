# 📱 R6-8 iPhone Playback Metrics Report

## 📋 Test Summary
- **Test Date**: 2025-10-06T22:12:39.801Z
- **User Agent**: iOS 17.0 Mobile Safari
- **Scenarios Tested**: 4
- **Overall Success**: ✅

## 🎯 iOS Compatibility: EXCELLENT

### Key Metrics
| Metric | Value | Status |
|--------|-------|--------|
| **Avg First Audio** | 0ms | ✅ |
| **Total Stalls** | 0 | ✅ |
| **Max Gap** | 0ms | ✅ |
| **Success Rate** | 100.0% | ✅ |

## 📊 Scenario Results


### Foreground Playback
- **Status**: ✅ PASSED
- **Duration**: 1001ms
- **First Audio**: N/Ams
- **Stalls**: 0
- **Longest Gap**: 0ms
- **Continuity**: ✅



### Background/Lockscreen
- **Status**: ✅ PASSED
- **Duration**: 6260ms
- **First Audio**: N/Ams
- **Stalls**: 0
- **Longest Gap**: 0ms
- **Continuity**: ✅



### Network Transition
- **Status**: ✅ PASSED
- **Duration**: 1682ms
- **First Audio**: N/Ams
- **Stalls**: 0
- **Longest Gap**: 0ms
- **Continuity**: ✅



### Segment Gap Analysis
- **Status**: ✅ PASSED
- **Duration**: 12803ms
- **First Audio**: N/Ams
- **Stalls**: 0
- **Longest Gap**: 0ms
- **Continuity**: ✅



## 🔍 Diagnostics Correlation

- **Status**: ok
- **Segment Count**: undefined
- **Total Duration**: undefinedms
- **Average EXTINF**: undefinedms


## 💡 Recommendations



## 📈 Detailed Timeline

### Most Recent Test: Segment Gap Analysis
- **1ms**: playlist_request_start
- **246ms**: playlist_response (245ms)
- **246ms**: playlist_parsed
- **246ms**: segment_request_start
- **433ms**: segment_response (186ms)
- **433ms**: segment_request_start
- **700ms**: segment_response (267ms)
- **700ms**: segment_request_start
- **914ms**: segment_response (214ms)
- **914ms**: gap_measurement


## ⚙️ Test Configuration
- **Base URL**: https://radio-importante-pwa-backend-skg2w.ondigitalocean.app
- **Timeout**: 20000ms
- **Stall Threshold**: 500ms
- **Max Gap Threshold**: 17000ms

---
*Generated at: 2025-10-06T22:13:05.856Z*  
*R6-8 iPhone Playback Metrics Validation Complete*
