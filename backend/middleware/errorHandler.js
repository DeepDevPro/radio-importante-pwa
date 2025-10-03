// Error handler middleware
// Extraído de app.js para facilitar manutenção
/* eslint-env node */

function errorHandler(err, req, res, next) {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Erro interno do servidor'
  });
}

module.exports = errorHandler;
