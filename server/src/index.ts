import app from './app.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 DepLens Backend Server running on http://localhost:${PORT}`);
  console.log(`📌 Demo Mode: ${process.env.DEMO_MODE || 'true'}`);
});
