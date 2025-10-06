#!/bin/bash

# R6-7: Smoke Automation Wrapper Script
# Facilita execução do sistema de monitoramento 24h

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
AUTOMATION_SCRIPT="$SCRIPT_DIR/smoke-automation.cjs"

# Default configuration
INTERVAL_MINUTES=${SMOKE_INTERVAL_MINUTES:-30}
DURATION_HOURS=${SMOKE_DURATION_HOURS:-24}
FAILURE_THRESHOLD=${SMOKE_FAILURE_THRESHOLD:-5.0}
OUTPUT_DIR=${SMOKE_OUTPUT_DIR:-"$PROJECT_ROOT/devFiles/temps"}
LOG_LEVEL=${SMOKE_LOG_LEVEL:-info}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                R6-7: Smoke Test 24h Automation              ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
}

print_config() {
    echo -e "${YELLOW}📋 Configuration:${NC}"
    echo "  • Interval: ${INTERVAL_MINUTES} minutes"
    echo "  • Duration: ${DURATION_HOURS} hours"
    echo "  • Expected runs: $((DURATION_HOURS * 60 / INTERVAL_MINUTES))"
    echo "  • Failure threshold: ${FAILURE_THRESHOLD}%"
    echo "  • Output directory: ${OUTPUT_DIR}"
    echo "  • Log level: ${LOG_LEVEL}"
    echo
}

check_dependencies() {
    echo -e "${BLUE}🔍 Checking dependencies...${NC}"
    
    if [ ! -f "$AUTOMATION_SCRIPT" ]; then
        echo -e "${RED}❌ Automation script not found: $AUTOMATION_SCRIPT${NC}"
        exit 1
    fi
    
    if [ ! -f "$SCRIPT_DIR/hls-smoke.cjs" ]; then
        echo -e "${RED}❌ Smoke test script not found: $SCRIPT_DIR/hls-smoke.cjs${NC}"
        exit 1
    fi
    
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js not found${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ All dependencies found${NC}"
    echo
}

start_automation() {
    print_header
    print_config
    check_dependencies
    
    echo -e "${GREEN}🚀 Starting smoke automation...${NC}"
    echo "  • Press Ctrl+C to stop gracefully"
    echo "  • Monitor progress in: ${OUTPUT_DIR}/smoke-24h-report-progress.json"
    echo "  • Live logs will appear below"
    echo
    
    # Create output directory
    mkdir -p "$OUTPUT_DIR"
    
    # Export configuration
    export SMOKE_INTERVAL_MINUTES="$INTERVAL_MINUTES"
    export SMOKE_DURATION_HOURS="$DURATION_HOURS"
    export SMOKE_FAILURE_THRESHOLD="$FAILURE_THRESHOLD"
    export SMOKE_OUTPUT_DIR="$OUTPUT_DIR"
    export SMOKE_LOG_LEVEL="$LOG_LEVEL"
    
    # Start automation
    cd "$PROJECT_ROOT"
    exec node "$AUTOMATION_SCRIPT" start
}

stop_automation() {
    echo -e "${YELLOW}🛑 Stopping automation...${NC}"
    
    # Find and kill automation process
    local pids=$(pgrep -f "smoke-automation.cjs" || true)
    if [ -n "$pids" ]; then
        echo "  • Found running automation processes: $pids"
        echo "$pids" | xargs kill -TERM
        echo -e "${GREEN}✅ Automation stopped${NC}"
    else
        echo -e "${YELLOW}⚠️  No running automation found${NC}"
    fi
}

show_status() {
    echo -e "${BLUE}📊 Checking automation status...${NC}"
    
    local progress_file="$OUTPUT_DIR/smoke-24h-report-progress.json"
    if [ -f "$progress_file" ]; then
        echo -e "${GREEN}✅ Progress file found: $progress_file${NC}"
        
        # Extract key metrics using node
        node -e "
            const fs = require('fs');
            try {
                const data = JSON.parse(fs.readFileSync('$progress_file', 'utf8'));
                const stats = data.statistics;
                const meta = data.metadata;
                console.log('');
                console.log('📈 Current Statistics:');
                console.log('  • Runs completed: ' + stats.totalRuns + '/' + Math.ceil((meta.configuration.maxDurationHours * 60) / meta.configuration.intervalMinutes));
                console.log('  • Success rate: ' + (100 - stats.failureRate).toFixed(1) + '%');
                console.log('  • Failure rate: ' + stats.failureRate + '%');
                console.log('  • Diagnostics P95: ' + stats.diagnosticsP95 + 'ms');
                console.log('  • Progress: ' + meta.progress.toFixed(1) + '%');
                console.log('  • Elapsed: ' + meta.elapsedHours.toFixed(1) + 'h');
                console.log('');
            } catch (e) {
                console.log('❌ Error reading progress file:', e.message);
            }
        "
    else
        echo -e "${YELLOW}⚠️  No progress file found${NC}"
    fi
    
    # Check for running processes
    local pids=$(pgrep -f "smoke-automation.cjs" || true)
    if [ -n "$pids" ]; then
        echo -e "${GREEN}🟢 Automation is running (PID: $pids)${NC}"
    else
        echo -e "${RED}🔴 Automation is not running${NC}"
    fi
}

show_reports() {
    echo -e "${BLUE}📄 Available reports in ${OUTPUT_DIR}:${NC}"
    echo
    
    local reports_found=false
    
    for file in "$OUTPUT_DIR"/smoke-24h-report-*.{json,md}; do
        if [ -f "$file" ]; then
            reports_found=true
            local filename=$(basename "$file")
            local size=$(du -h "$file" | cut -f1)
            local modified=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$file" 2>/dev/null || date -r "$file" "+%Y-%m-%d %H:%M" 2>/dev/null || echo "unknown")
            
            if [[ "$filename" == *"final"* ]]; then
                echo -e "  🏁 ${GREEN}$filename${NC} ($size) - $modified"
            elif [[ "$filename" == *"progress"* ]]; then
                echo -e "  📊 ${YELLOW}$filename${NC} ($size) - $modified"
            elif [[ "$filename" == *"summary"* ]]; then
                echo -e "  📋 ${BLUE}$filename${NC} ($size) - $modified"
            else
                echo -e "  📄 $filename ($size) - $modified"
            fi
        fi
    done
    
    if [ "$reports_found" = false ]; then
        echo -e "${YELLOW}  ⚠️  No reports found${NC}"
    fi
    echo
}

usage() {
    echo "Usage: $0 [command] [options]"
    echo
    echo "Commands:"
    echo "  start     Start 24h smoke automation (default)"
    echo "  stop      Stop running automation"
    echo "  status    Show current automation status"
    echo "  reports   List available reports"
    echo "  config    Show current configuration"
    echo "  help      Show this help"
    echo
    echo "Environment Variables:"
    echo "  SMOKE_INTERVAL_MINUTES=30     # Test interval"
    echo "  SMOKE_DURATION_HOURS=24       # Total duration"
    echo "  SMOKE_FAILURE_THRESHOLD=5.0   # Max failure rate %"
    echo "  SMOKE_OUTPUT_DIR=...          # Report output directory"
    echo "  SMOKE_LOG_LEVEL=info          # debug|info|warn|error"
    echo
    echo "Examples:"
    echo "  $0 start                      # Start with defaults"
    echo "  $0 status                     # Check progress"
    echo "  SMOKE_INTERVAL_MINUTES=15 $0 start  # 15min intervals"
    echo
}

# Main command handling
case "${1:-start}" in
    start)
        start_automation
        ;;
    stop)
        stop_automation
        ;;
    status)
        show_status
        ;;
    reports)
        show_reports
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
