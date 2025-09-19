# 📋 FASE 3: DOMÍNIO E DNS - CRONOGRAMA DETALHADO

> **Duração estimada:** 30 minutos  
> **Objetivo:** Configurar domínio customizado e atualizar DNS para Digital Ocean  
> **Responsável:** GPT 4.1 (execução autônoma)  
> **Dependência:** Fase 2 concluída com aplicação totalmente funcional

---

## 🎯 **VISÃO GERAL DA FASE 3**

Esta fase configura o domínio `radio.importantestudio.com` para apontar para a Digital Ocean, mantendo o Route 53 temporariamente para facilitar rollback. O objetivo é ter o domínio de produção funcionando na nova infraestrutura.

### **Status inicial da Fase 3:**
- ✅ Frontend funcionando na Digital Ocean com URL temporária
- ✅ Todas as funcionalidades testadas e aprovadas
- ❌ Domínio ainda apontando para AWS (CloudFront)
- 🎯 Meta: Domínio de produção funcionando na Digital Ocean

---

## 📝 **LISTA DE TAREFAS DETALHADAS**

### **TAREFA 3.1: Preparar Configuração de Domínio na Digital Ocean (10 min)**

#### **Objetivo:**
Configurar o domínio customizado na aplicação Digital Ocean e obter informações necessárias para DNS.

#### **Checklist:**
- [ ] **3.1.1** Acessar configurações da app frontend
  ```bash
  # URL: https://cloud.digitalocean.com/apps
  # Navegar para: radio-importante-frontend > Settings > Domains
  ```

- [ ] **3.1.2** Adicionar domínio customizado
  - Domain: `radio.importantestudio.com`
  - Type: `Primary Domain`
  - SSL: `Automatic (Let's Encrypt)`

- [ ] **3.1.3** Obter informações DNS da Digital Ocean
  ```bash
  # Anotar as informações fornecidas pela DO:
  # CNAME record: _________________________
  # A record (se fornecido): _________________________
  # Verificação SSL domain: _________________________
  ```

- [ ] **3.1.4** Verificar status atual do domínio
  ```bash
  dig radio.importantestudio.com
  # Confirmar que ainda aponta para CloudFront
  nslookup radio.importantestudio.com
  # Anotar configuração atual para rollback
  ```

- [ ] **3.1.5** Documentar configuração AWS atual
  ```bash
  # Para rollback posterior:
  # CloudFront CNAME atual: d2qohgpgjz7kez.cloudfront.net
  # Route 53 Record atual: Type CNAME, Value: CloudFront
  ```

#### **Critério de sucesso:**
Domínio configurado na Digital Ocean e informações DNS obtidas.

---

### **TAREFA 3.2: Atualizar DNS no Route 53 (10 min)**

#### **Objetivo:**
Atualizar o registro DNS no Route 53 para apontar para a Digital Ocean.

#### **Checklist:**
- [ ] **3.2.1** Fazer backup da configuração atual
  ```bash
  aws route53 list-resource-record-sets \
    --hosted-zone-id Z1D633PJN98FT9 \
    --query "ResourceRecordSets[?Name=='radio.importantestudio.com.']" \
    > dns_backup_$(date +%Y%m%d_%H%M%S).json
  ```

- [ ] **3.2.2** Atualizar registro para Digital Ocean
  ```bash
  # Criar arquivo de mudança DNS
  cat > dns_change.json << EOF
  {
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "radio.importantestudio.com",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "[CNAME-DA-DIGITAL-OCEAN]"}]
      }
    }]
  }
  EOF
  ```

- [ ] **3.2.3** Aplicar mudança DNS
  ```bash
  aws route53 change-resource-record-sets \
    --hosted-zone-id Z1D633PJN98FT9 \
    --change-batch file://dns_change.json
  ```

- [ ] **3.2.4** Verificar mudança aplicada
  ```bash
  aws route53 list-resource-record-sets \
    --hosted-zone-id Z1D633PJN98FT9 \
    --query "ResourceRecordSets[?Name=='radio.importantestudio.com.']"
  ```

- [ ] **3.2.5** Aguardar propagação DNS
  ```bash
  # TTL está em 300s (5min), aguardar propagação
  # Verificar propagação:
  dig radio.importantestudio.com
  nslookup radio.importantestudio.com
  ```

#### **Critério de sucesso:**
DNS atualizado no Route 53 e propagação iniciada.

---

### **TAREFA 3.3: Validar Propagação DNS e SSL (5 min)**

#### **Objetivo:**
Confirmar que o DNS propagou corretamente e o SSL está funcionando.

#### **Checklist:**
- [ ] **3.3.1** Verificar propagação DNS em múltiplos resolvers
  ```bash
  # Testar diferentes DNS servers
  nslookup radio.importantestudio.com 8.8.8.8
  nslookup radio.importantestudio.com 1.1.1.1
  nslookup radio.importantestudio.com
  
  # Deve apontar para Digital Ocean
  ```

- [ ] **3.3.2** Testar acesso via domínio
  ```bash
  curl -I https://radio.importantestudio.com/
  # Deve retornar HTTP/2 200 da Digital Ocean
  ```

- [ ] **3.3.3** Verificar certificado SSL
  ```bash
  openssl s_client -connect radio.importantestudio.com:443 -servername radio.importantestudio.com </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer
  # Deve mostrar Let's Encrypt certificate
  ```

- [ ] **3.3.4** Testar HTTPS redirect
  ```bash
  curl -I http://radio.importantestudio.com/
  # Deve redirecionar para HTTPS (301/302)
  ```

- [ ] **3.3.5** Verificar no navegador
  ```bash
  # Abrir https://radio.importantestudio.com/
  # Verificar:
  # - Certificado SSL válido (cadeado verde)
  # - Página carrega corretamente
  # - Não há warnings de mixed content
  ```

#### **Critério de sucesso:**
Domínio acessível via HTTPS com certificado SSL válido.

---

### **TAREFA 3.4: Testar Funcionalidades com Domínio Customizado (3 min)**

#### **Objetivo:**
Validar que todas as funcionalidades funcionam corretamente com o domínio de produção.

#### **Checklist:**
- [ ] **3.4.1** Testar player principal
  ```bash
  # No navegador: https://radio.importantestudio.com/
  # Verificar:
  # - Player carrega sem erros
  # - Interface responsiva funciona
  # - Sem warnings de SSL/mixed content
  ```

- [ ] **3.4.2** Testar admin panel
  ```bash
  # No navegador: https://radio.importantestudio.com/admin.html
  # Verificar:
  # - Admin panel carrega
  # - Lista de músicas aparece
  # - Conexão com backend DO funcionando
  # - Upload funciona corretamente
  ```

- [ ] **3.4.3** Testar PWA installation
  ```bash
  # No navegador:
  # - Verificar se aparece opção "Install App"
  # - Testar instalação
  # - Verificar se PWA instalada funciona
  ```

- [ ] **3.4.4** Verificar analytics e tracking
  ```bash
  # Se houver Google Analytics ou similar:
  # Verificar se tracking está funcionando
  # Confirmar que requests são enviados corretamente
  ```

#### **Critério de sucesso:**
Todas as funcionalidades funcionando perfeitamente com domínio customizado.

---

### **TAREFA 3.5: Documentar Nova Configuração (2 min)**

#### **Objetivo:**
Documentar a nova configuração para referência futura e troubleshooting.

#### **Checklist:**
- [ ] **3.5.1** Documentar configuração DNS
  ```bash
  # Configuração atual:
  # Domínio: radio.importantestudio.com
  # DNS Provider: Route 53
  # Record Type: CNAME
  # Value: _________________________
  # TTL: 300
  ```

- [ ] **3.5.2** Documentar configuração SSL
  ```bash
  # SSL Provider: Let's Encrypt (Digital Ocean)
  # Certificate Valid: ✅/❌
  # Auto-renewal: ✅/❌
  # Expiration Date: _________________________
  ```

- [ ] **3.5.3** Documentar URLs funcionais
  ```bash
  # URLs de produção:
  # Player: https://radio.importantestudio.com/
  # Admin: https://radio.importantestudio.com/admin.html
  # Backend: https://radio-importante-pwa-backend-skg2w.ondigitalocean.app
  ```

- [ ] **3.5.4** Criar plano de rollback atualizado
  ```bash
  # Para rollback rápido:
  # 1. Executar: aws route53 change-resource-record-sets --change-batch file://rollback_dns.json
  # 2. Aguardar 5-10 minutos para propagação
  # 3. Verificar: curl -I https://radio.importantestudio.com/
  ```

#### **Critério de sucesso:**
Documentação completa criada e plano de rollback atualizado.

---

## 📊 **DOCUMENTAÇÃO DA EXECUÇÃO**

### **Informações a serem coletadas durante execução:**

- [ ] **Horário início DNS change:** `_________________________`
- [ ] **CNAME da Digital Ocean:** `_________________________`
- [ ] **Tempo de propagação DNS:** `_________________________`
- [ ] **SSL certificate issuer:** `_________________________`
- [ ] **Status final dos testes:** `_________________________`

### **Verificações críticas:**
- [ ] **DNS propagou:** ✅/❌
- [ ] **SSL funcionando:** ✅/❌
- [ ] **Redirecionamento HTTP→HTTPS:** ✅/❌
- [ ] **Player funcionando:** ✅/❌
- [ ] **Admin funcionando:** ✅/❌

---

## 🚨 **TROUBLESHOOTING COMUM**

### **Problema 1: DNS não propaga**
```bash
# Soluções:
# 1. Verificar TTL (300s = 5min mínimo)
# 2. Testar em diferentes DNS resolvers
# 3. Usar ferramentas online: whatsmydns.net
# 4. Aguardar até 24h em casos extremos
```

### **Problema 2: SSL certificate falha**
```bash
# Debug:
# 1. Verificar se domínio foi validado na DO
# 2. Aguardar até 30min para provisionamento
# 3. Verificar se DNS está correto
# 4. Contatar suporte DO se necessário
```

### **Problema 3: Mixed content warnings**
```bash
# Soluções:
# 1. Verificar se todas as URLs são HTTPS
# 2. Confirmar backend está usando HTTPS
# 3. Verificar configuração CORS
```

### **Problema 4: Rollback necessário**
```bash
# Rollback rápido:
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1D633PJN98FT9 \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "radio.importantestudio.com",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "d2qohgpgjz7kez.cloudfront.net"}]
      }
    }]
  }'
```

---

## ✅ **CRITÉRIOS DE CONCLUSÃO DA FASE 3**

### **Para considerar Fase 3 completa, verificar:**

- [ ] ✅ Domínio configurado na Digital Ocean
- [ ] ✅ DNS atualizado no Route 53
- [ ] ✅ DNS propagou corretamente
- [ ] ✅ SSL certificate funcionando
- [ ] ✅ HTTPS redirect ativo
- [ ] ✅ Player funcionando com domínio customizado
- [ ] ✅ Admin panel funcionando com domínio customizado
- [ ] ✅ PWA installation funcionando
- [ ] ✅ Documentação completa criada
- [ ] ✅ Plano de rollback atualizado

### **Outputs esperados:**
1. **Domínio de produção:** `https://radio.importantestudio.com/`
2. **Status:** SSL ativo e funcionando
3. **Performance:** Mantida da Fase 2
4. **Next Step:** Configurar pipeline CI/CD (Fase 4)

---

## 📋 **PREPARAÇÃO PARA FASE 4**

### **Informações que serão necessárias na próxima fase:**
- [ ] Domínio funcionando: `https://radio.importantestudio.com/`
- [ ] Confirmação que auto-deploy DO está funcionando
- [ ] Access token Digital Ocean necessário
- [ ] GitHub repository permissions verificados

### **Pré-requisitos para Fase 4:**
- Acesso de admin ao repositório GitHub
- Token Digital Ocean com permissões de deploy
- Workflows AWS prontos para desabilitação

---

## 🔧 **COMANDOS DE REFERÊNCIA RÁPIDA**

### **Verificação DNS:**
```bash
# Status completo
dig radio.importantestudio.com
nslookup radio.importantestudio.com
curl -I https://radio.importantestudio.com/

# SSL check
openssl s_client -connect radio.importantestudio.com:443 -servername radio.importantestudio.com </dev/null 2>/dev/null | openssl x509 -noout -dates
```

### **Rollback rápido:**
```bash
# Reverter DNS para AWS
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1D633PJN98FT9 \
  --change-batch file://rollback_dns.json
```

---

*Documento criado para execução por GPT 4.1 - continuação da Fase 2.*
