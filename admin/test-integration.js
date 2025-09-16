/**
 * ===== TESTES DE INTEGRAÇÃO =====
 * Scripts para validar a refatoração
 */

// Testes básicos de funcionalidade
async function runIntegrationTests() {
    console.log('🧪 Iniciando testes de integração...');
    const results = [];

    // Teste 1: Verificar se módulos foram carregados
    try {
        const hasAdmin = typeof window.adminApp !== 'undefined';
        const hasDebug = typeof window.adminDebug !== 'undefined';
        results.push({
            test: 'Módulos carregados',
            passed: hasAdmin && hasDebug,
            details: `Admin: ${hasAdmin}, Debug: ${hasDebug}`
        });
    } catch (error) {
        results.push({
            test: 'Módulos carregados',
            passed: false,
            error: error.message
        });
    }

    // Teste 2: Verificar elementos DOM
    try {
        const elements = [
            'backend-status',
            'upload-area', 
            'file-input',
            'music-list'
        ];
        
        const missing = elements.filter(id => !document.getElementById(id));
        results.push({
            test: 'Elementos DOM',
            passed: missing.length === 0,
            details: missing.length > 0 ? `Faltando: ${missing.join(', ')}` : 'Todos presentes'
        });
    } catch (error) {
        results.push({
            test: 'Elementos DOM',
            passed: false,
            error: error.message
        });
    }

    // Teste 3: Verificar CSS
    try {
        const testElement = document.querySelector('.btn');
        const styles = window.getComputedStyle(testElement);
        const hasStyles = styles.backgroundColor !== 'rgba(0, 0, 0, 0)';
        
        results.push({
            test: 'CSS carregado',
            passed: hasStyles,
            details: `Background color: ${styles.backgroundColor}`
        });
    } catch (error) {
        results.push({
            test: 'CSS carregado',
            passed: false,
            error: error.message
        });
    }

    // Teste 4: Verificar funcionalidades
    try {
        const canSwitchTabs = typeof window.switchTab === 'function';
        const canShowAlert = typeof window.showAlert === 'function';
        
        results.push({
            test: 'Funcionalidades globais',
            passed: canSwitchTabs && canShowAlert,
            details: `switchTab: ${canSwitchTabs}, showAlert: ${canShowAlert}`
        });
    } catch (error) {
        results.push({
            test: 'Funcionalidades globais',
            passed: false,
            error: error.message
        });
    }

    // Mostrar resultados
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    
    console.log(`\n📊 Resultados dos testes: ${passed}/${total} passou`);
    results.forEach(result => {
        const icon = result.passed ? '✅' : '❌';
        console.log(`${icon} ${result.test}: ${result.details || result.error || 'OK'}`);
    });

    return { passed, total, results };
}

// Executar testes quando página carregar
window.addEventListener('load', () => {
    setTimeout(runIntegrationTests, 2000);
});
