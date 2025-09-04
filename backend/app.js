const express = require('express');
const app = express();

// Configurar CORS para permitir requisições do frontend
app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.get('/health', function(req, res) {
  res.json({ 
    status: 'OK', 
    message: 'Working',
    timestamp: new Date().toISOString(),
    cors: 'enabled'
  });
});

app.get('/', function(req, res) {
  res.json({ 
    message: 'Radio Backend API',
    version: '1.0.0',
    cors: 'enabled'
  });
});

const port = process.env.PORT || 8080;
app.listen(port, function() {
  console.log('Server running on port ' + port);
});
