import app from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';

const startServer = async () => {
  console.log('[SERVER] Starting ResolveAI backend...');
  
  // 1. Establish database connection
  await connectDB();

  // 2. Start listener on PORT and interface 0.0.0.0
  const PORT = env.port || 5000;
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] Success: ResolveAI is listening on http://0.0.0.0:${PORT}`);
    console.log(`[SERVER] Mode: ${process.env.NODE_ENV || 'development'}`);
  });
};

startServer().catch((error) => {
  console.error('[SERVER CRITICAL ERROR] Server failed to start:', error.message);
  process.exit(1);
});
