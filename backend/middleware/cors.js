// CORS middleware para desenvolvimento
// Extraído de app.js para facilitar manutenção
/* eslint-env node */

function corsMiddleware(req, res, next) {
  const corsOrigins = process.env.CORS_ORIGINS || 'https://radio.importantestudio.com';
  const allowedOrigins = corsOrigins.split(',').map(origin => origin.trim());
  const requestOrigin = req.headers.origin;
  
  if (allowedOrigins.includes(requestOrigin)) {
    res.header('Access-Control-Allow-Origin', requestOrigin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
}

module.exports = corsMiddleware;
