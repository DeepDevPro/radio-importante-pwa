// 404 Not Found handler middleware
// Extraído de app.js para facilitar manutenção
/* eslint-env node */

function notFoundHandler(req, res) {
  res.status(404).json({ 
    error: 'Endpoint não encontrado',
    path: req.originalUrl
  });
}

module.exports = notFoundHandler;
