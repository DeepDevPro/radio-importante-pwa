const express = require('express');
const app = express();

app.get('/health', function(req, res) {
  res.json({ status: 'OK', message: 'Working' });
});

app.get('/', function(req, res) {
  res.json({ message: 'Radio Backend API' });
});

const port = process.env.PORT || 8080;
app.listen(port, function() {
  console.log('Server running on port ' + port);
});
