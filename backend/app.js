const express = require('express');
const app = express();
const port = process.env.PORT || 8080;

// Middleware básico
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        message: 'Backend funcionando!',
        timestamp: new Date().toISOString(),
        version: '2.2.4'
    });
});

// Endpoint principal
app.get('/', (req, res) => {
    res.json({ 
        message: 'Radio Importante Backend - API Online!', 
        status: 'success',
        endpoints: ['/health', '/api/catalog']
    });
});

// Iniciar servidor
app.listen(port, () => {
    console.log(`✅ Servidor rodando na porta ${port}`);
    console.log(`🔗 Health check: http://localhost:${port}/health`);
});
