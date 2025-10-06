#!/bin/bash

# R6-7: 24h Stability + Smoke Automation
# Executa smoke tests em intervalo por 24h agregando métricas

echo "⏰ R6-7: 24h Stability + Smoke Automation"
echo "============================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INTERVAL_MINUTES=${1:-30}  # Default: 30 minutos
TOTAL_HOURS=${2:-24}       # Default: 24 horas
REPORT_DIR="$SCRIPT_DIR/../devFiles/temps"
REPORT_FILE="$REPORT_DIR/24h-stability-report.json"

# Calcular iterações
ITERATIONS=$(( TOTAL_HOURS * 60 / INTERVAL_MINUTES ))

echo "📊 Configuration:"
echo "   Interval: ${INTERVAL_MINUTES} minutes"
echo "   Duration: ${TOTAL_HOURS} hours"
echo "   Total iterations: ${ITERATIONS}"
echo "   Report: $REPORT_FILE"
echo ""

# Garantir diretório de relatório
mkdir -p "$REPORT_DIR"

# Inicializar relatório
cat > "$REPORT_FILE" << EOF
{
  "startTime": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "config": {
    "intervalMinutes": $INTERVAL_MINUTES,
    "totalHours": $TOTAL_HOURS,
    "targetIterations": $ITERATIONS
  },
  "results": [],
  "summary": {
    "completed": 0,
    "successful": 0,
    "failed": 0,
    "failureRate": 0.0,
    "avgDuration": 0,
    "p95Diagnostics": 0
  }
}
EOF

echo "🚀 Starting 24h automation..."
echo "⏸️  Use Ctrl+C to stop gracefully"

# Função para atualizar sumário
update_summary() {
  local temp_file=$(mktemp)
  
  node -e "
    const fs = require('fs');
    const report = JSON.parse(fs.readFileSync('$REPORT_FILE', 'utf8'));
    const results = report.results;
    
    if (results.length === 0) return;
    
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;
    const durations = results.map(r => r.duration);
    const diagTimes = results.filter(r => r.diagnostics).map(r => r.diagnostics.durationMs);
    
    report.summary = {
      completed: results.length,
      successful: successful,
      failed: failed,
      failureRate: (failed / results.length) * 100,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      p95Diagnostics: diagTimes.length > 0 ? 
        diagTimes.sort((a, b) => a - b)[Math.floor(diagTimes.length * 0.95)] : 0
    };
    
    report.endTime = new Date().toISOString();
    
    fs.writeFileSync('$temp_file', JSON.stringify(report, null, 2));
  " && mv "$temp_file" "$REPORT_FILE"
}

# Função de cleanup graceful
cleanup() {
  echo ""
  echo "🛑 Stopping automation..."
  update_summary
  
  echo "📋 Final Summary:"
  jq -r '.summary | 
    "✅ Completed: \(.completed)/\(.completed) iterations\n" +
    "📈 Success rate: \((100 - .failureRate) | floor)%\n" +
    "⚡ Avg duration: \(.avgDuration | floor)ms\n" +
    "📊 P95 diagnostics: \(.p95Diagnostics)ms"' "$REPORT_FILE"
  
  echo "📄 Full report: $REPORT_FILE"
  exit 0
}

# Capturar Ctrl+C
trap cleanup INT TERM

# Loop principal
for ((i=1; i<=ITERATIONS; i++)); do
  echo ""
  echo "🔄 Iteration $i/$ITERATIONS - $(date)"
  
  start_time=$(date +%s%3N)
  
  # Executar smoke test
  if node "$SCRIPT_DIR/hls-smoke.cjs" > /dev/null 2>&1; then
    success=true
    echo "✅ Smoke test PASSED"
  else
    success=false
    echo "❌ Smoke test FAILED"
  fi
  
  end_time=$(date +%s%3N)
  duration=$((end_time - start_time))
  
  # Coletar diagnósticos
  diag_data=""
  if diag_response=$(curl -s "https://radio-importante-pwa-backend-skg2w.ondigitalocean.app/api/hls/latest/diagnostics"); then
    if echo "$diag_response" | jq -e '.success' > /dev/null 2>&1; then
      diag_duration=$(echo "$diag_response" | jq -r '.durationMs // 0')
      diag_data=", \"diagnostics\": { \"durationMs\": $diag_duration }"
    fi
  fi
  
  # Adicionar resultado ao relatório
  temp_file=$(mktemp)
  jq ".results += [{
    \"iteration\": $i,
    \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",
    \"success\": $success,
    \"duration\": $duration
    $diag_data
  }]" "$REPORT_FILE" > "$temp_file" && mv "$temp_file" "$REPORT_FILE"
  
  # Atualizar sumário
  update_summary
  
  # Mostrar progresso
  current_success=$(jq -r '.summary.successful' "$REPORT_FILE")
  current_rate=$(jq -r '.summary.failureRate' "$REPORT_FILE")
  echo "📊 Progress: $current_success/$i successful (${current_rate}% failure rate)"
  
  # Aguardar próxima iteração (exceto na última)
  if [ $i -lt $ITERATIONS ]; then
    echo "⏱️  Waiting ${INTERVAL_MINUTES} minutes..."
    sleep $((INTERVAL_MINUTES * 60))
  fi
done

echo ""
echo "🎉 24h automation completed successfully!"
cleanup
