import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';

async function main() {
  if (env.isProd && env.payments.provider === 'mock') {
    logger.warn('PAYMENT_PROVIDER=mock in production: online payments cannot be verified and will always fail. Set PAYMENT_PROVIDER=razorpay.');
  }
  await connectDB();
  const app = createApp();

  const server = app.listen(env.port, () => {
    logger.info(`Aali Market API listening on port ${env.port} (${env.nodeEnv})`);
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down gracefully`);
    server.close(() => process.exit(0));
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error(`Fatal startup error: ${err.message}`, { stack: err.stack });
  process.exit(1);
});
