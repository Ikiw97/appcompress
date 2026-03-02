require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n🚀 FileZen Backend running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔄 Convert: POST http://localhost:${PORT}/convert`);
  console.log(`🗜️  Compress: POST http://localhost:${PORT}/compress\n`);
});
