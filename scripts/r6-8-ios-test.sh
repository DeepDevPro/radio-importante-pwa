#!/bin/bash

# R6-8: iOS Playback Metrics Test Wrapper
# Facilita execução dos testes específicos iOS

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
IOS_TEST_SCRIPT="$SCRIPT_DIR/ios-playback-test.cjs"

# Default configuration
BASE_URL=${HLS_BASE_URL:-"https://radio-importante-pwa-backend-skg2w.ondigitalocean.app"}
OUTPUT_DIR=${IOS_METRICS_OUTPUT:-"$PROJECT_ROOT/devFiles/temps"}
TIMEOUT_MS=${IOS_TIMEOUT_MS:-20000}
STALL_THRESHOLD=${IOS_STALL_THRESHOLD:-500}
MAX_GAP_THRESHOLD=${IOS_MAX_GAP_THRESHOLD:-17000}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${PURPLE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║            R6-8: iPhone Playback Metrics Validation          ║${NC}"
    echo -e "${PURPLE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
}

print_config() {
    echo -e "${YELLOW}📱 Test Configuration:${NC}"
    echo "  • Base URL: ${BASE_URL}"
    echo "  • Timeout: ${TIMEOUT_MS}ms"
    echo "  • Stall threshold: ${STALL_THRESHOLD}ms"
    echo "  • Max gap threshold: ${MAX_GAP_THRESHOLD}ms"
    echo "  • Output directory: ${OUTPUT_DIR}"
    echo "  • User Agent: iOS 17.0 Mobile Safari"
    echo
}

print_scenarios() {
    echo -e "${BLUE}🧪 Test Scenarios:${NC}"
    echo "  1. 📱 Foreground Playback - Standard HLS playback"
    echo "  2. 🔒 Background/Lockscreen - Simulated background behavior"
    echo "  3. 📶 Network Transition - Network quality changes"
    echo "  4. ⏱️  Segment Gap Analysis - Timing analysis between segments"
    echo
}

check_dependencies() {
    echo -e "${BLUE}🔍 Checking dependencies...${NC}"
    
    if [ ! -f "$IOS_TEST_SCRIPT" ]; then
        echo -e "${RED}❌ iOS test script not found: $IOS_TEST_SCRIPT${NC}"
        exit 1
    fi
    
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js not found${NC}"
        exit 1
    fi
    
    # Test connectivity to HLS endpoint
    echo "  • Testing connectivity to HLS endpoint..."
    if curl -s --max-time 10 --head "${BASE_URL}/hls/rolling/index.m3u8" > /dev/null; then
        echo -e "${GREEN}✅ HLS endpoint accessible${NC}"
    else
        echo -e "${YELLOW}⚠️  Warning: HLS endpoint may not be accessible${NC}"
    fi
    
    echo
}

run_ios_tests() {
    print_header
    print_config
    print_scenarios
    check_dependencies
    
    echo -e "${GREEN}🚀 Starting iOS playback metrics validation...${NC}"
    echo "  • Testing rolling playlist with iOS-specific scenarios"
    echo "  • Collecting metrics: tFirstAudio, stallCount, longestGap, continuity"
    echo "  • Correlating with diagnostics data"
    echo
    
    # Create output directory
    mkdir -p "$OUTPUT_DIR"
    
    # Export configuration
    export HLS_BASE_URL="$BASE_URL"
    export IOS_METRICS_OUTPUT="$OUTPUT_DIR"
    export IOS_TIMEOUT_MS="$TIMEOUT_MS"
    export IOS_STALL_THRESHOLD="$STALL_THRESHOLD"
    export IOS_MAX_GAP_THRESHOLD="$MAX_GAP_THRESHOLD"
    
    # Run iOS tests
    cd "$PROJECT_ROOT"
    echo -e "${BLUE}📊 Running iOS playback tests...${NC}"
    
    if node "$IOS_TEST_SCRIPT"; then
        echo
        echo -e "${GREEN}✅ iOS playback tests completed successfully!${NC}"
        show_results
        return 0
    else
        echo
        echo -e "${RED}❌ iOS playbook tests failed!${NC}"
        show_results
        return 1
    fi
}

show_results() {
    echo -e "${BLUE}📄 Generated Reports:${NC}"
    echo
    
    local reports_found=false
    
    for file in "$OUTPUT_DIR"/ios-playback-metrics-*.{json,md}; do
        if [ -f "$file" ]; then
            reports_found=true
            local filename=$(basename "$file")
            local size=$(du -h "$file" | cut -f1)
            local modified=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$file" 2>/dev/null || date -r "$file" "+%Y-%m-%d %H:%M" 2>/dev/null || echo "unknown")
            
            if [[ "$filename" == *".json" ]]; then
                echo -e "  📊 ${GREEN}$filename${NC} ($size) - $modified [Structured Data]"
            elif [[ "$filename" == *".md" ]]; then
                echo -e "  📋 ${BLUE}$filename${NC} ($size) - $modified [Human Report]"
            fi
        fi
    done
    
    if [ "$reports_found" = false ]; then
        echo -e "${YELLOW}  ⚠️  No reports found in ${OUTPUT_DIR}${NC}"
    fi
    echo
}

show_latest_report() {
    echo -e "${BLUE}📋 Latest iOS Test Report:${NC}"
    echo
    
    local latest_md=$(ls -t "$OUTPUT_DIR"/ios-playback-metrics-*.md 2>/dev/null | head -1)
    if [ -f "$latest_md" ]; then
        echo -e "${GREEN}📄 Report: $(basename "$latest_md")${NC}"
        echo
        
        # Show key sections of the report
        if grep -q "## 🎯 iOS Compatibility" "$latest_md"; then
            echo -e "${YELLOW}🎯 iOS Compatibility:${NC}"
            grep -A 10 "## 🎯 iOS Compatibility" "$latest_md" | head -10
            echo
        fi
        
        if grep -q "### Key Metrics" "$latest_md"; then
            echo -e "${YELLOW}📊 Key Metrics:${NC}"
            grep -A 10 "### Key Metrics" "$latest_md" | head -10
            echo
        fi
        
        echo -e "${BLUE}📄 Full report: $latest_md${NC}"
    else
        echo -e "${YELLOW}⚠️  No reports found${NC}"
    fi
}

quick_test() {
    echo -e "${BLUE}🚀 Running quick iOS compatibility check...${NC}"
    
    # Quick test - just foreground scenario
    export IOS_TIMEOUT_MS=10000
    cd "$PROJECT_ROOT"
    
    node -e "
    const { iOSPlaybackTester } = require('$IOS_TEST_SCRIPT');
    async function quickTest() {
        const tester = new iOSPlaybackTester();
        const result = await tester.testScenario('foreground', {
            name: 'Quick Foreground Test',
            description: 'Quick iOS compatibility check',
            timeout: 10000,
            expectedStalls: 0
        });
        
        console.log('');
        console.log('🎯 Quick Test Result:');
        console.log('  Success:', result.success ? '✅' : '❌');
        console.log('  First Audio:', result.metrics.tFirstAudio || 'N/A', 'ms');
        console.log('  Stalls:', result.metrics.stallCount);
        console.log('  Longest Gap:', result.metrics.longestGap, 'ms');
        console.log('  Continuity:', result.metrics.continuityOk ? '✅' : '❌');
        
        process.exit(result.success ? 0 : 1);
    }
    quickTest().catch(console.error);
    "
}

usage() {
    echo "Usage: $0 [command] [options]"
    echo
    echo "Commands:"
    echo "  test      Run full iOS playback metrics validation (default)"
    echo "  quick     Run quick iOS compatibility check"
    echo "  results   Show latest test results"
    echo "  reports   List all available reports"
    echo "  config    Show current configuration"
    echo "  help      Show this help"
    echo
    echo "Environment Variables:"
    echo "  HLS_BASE_URL=...              # Base URL for HLS testing"
    echo "  IOS_TIMEOUT_MS=20000          # Request timeout"
    echo "  IOS_STALL_THRESHOLD=500       # Stall detection threshold"
    echo "  IOS_MAX_GAP_THRESHOLD=17000   # Max gap threshold"
    echo "  IOS_METRICS_OUTPUT=...        # Report output directory"
    echo
    echo "Examples:"
    echo "  $0 test                       # Full iOS validation"
    echo "  $0 quick                      # Quick compatibility check"
    echo "  $0 results                    # Show latest results"
    echo "  IOS_TIMEOUT_MS=30000 $0 test  # Test with longer timeout"
    echo
}

# Main command handling
case "${1:-test}" in
    test)
        run_ios_tests
        exit $?
        ;;
    quick)
        quick_test
        exit $?
        ;;
    results)
        show_latest_report
        ;;
    reports)
        show_results
        ;;
    config)
        print_config
        ;;
    help|--help|-h)
        usage
        ;;
    *)
        echo -e "${RED}❌ Unknown command: $1${NC}"
        echo
        usage
        exit 1
        ;;
esac
