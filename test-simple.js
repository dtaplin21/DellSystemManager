const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 8001;

// Simple root route test
app.get('/', (req, res) => {
  console.log('ROOT ROUTE HIT!');
  const filePath = path.join(__dirname, 'public', 'index.html');
  console.log('File path:', filePath);
  console.log('File exists:', fs.existsSync(filePath));
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.send('File not found but route works!');
  }
});

app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
});