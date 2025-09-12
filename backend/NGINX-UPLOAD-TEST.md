# Teste de Upload - Nginx Config

## Comandos de teste após deploy:

### 1. Teste pequeno (verificar se sai do 502):
```bash
curl -i -X POST "https://backend.radio.importantestudio.com/api/upload" \
  -H "Origin: https://radio.importantestudio.com" \
  -F "audioFiles=@/caminho/para/arquivo_pequeno.mp3;type=audio/mpeg" \
  -F "duration_0=10.0"
```

### 2. Teste médio (1-5MB):
```bash
curl -i -X POST "https://backend.radio.importantestudio.com/api/upload" \
  -H "Origin: https://radio.importantestudio.com" \
  -F "audioFiles=@/Volumes/Jr-1TB/Transferencias/radio-importante/60s-clips/01_Northern_Girls.mp3;type=audio/mpeg" \
  -F "duration_0=60.0"
```

### 3. Verificar logs em caso de erro:
- EB → Logs → Request logs
- Verificar `/var/log/nginx/error.log`
- Verificar `/var/log/web.stdout.log`

## Melhorias aplicadas:

### ✅ Configuração Global (conf.d/upload.conf):
- `client_max_body_size 100m`
- `proxy_buffering off`
- Timeouts aumentados
- Buffers otimizados

### ✅ Configuração de Rota (elasticbeanstalk/01_upload.conf):
- `proxy_request_buffering off` para /api/upload
- Timeouts específicos (10 minutos)
- Headers de debug
- Configuração para toda API

## Se ainda der 502:
1. Verificar se o Node.js está rodando na porta correta
2. Verificar logs do aplicativo
3. Testar arquivo pequeno primeiro
4. Verificar se AWS load balancer tem timeouts configurados
