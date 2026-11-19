// Runs the idempotent data migrations against MONGODB_URI. Usage: npm run migrate
import { connectDB, disconnectDB } from '../src/config/db.js';
import { logger } from '../src/config/logger.js';
import { runMigrations } from '../src/migrations/index.js';

try {
  await connectDB();
  const report = await runMigrations();
  logger.info(`Migrations done: ${JSON.stringify(report)}`);
} catch (err) {
  logger.error(`Migration failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
