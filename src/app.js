import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import { env } from './config/env.js';
import { morganStream } from './config/logger.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import routes from './routes/index.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.trustProxy);
  app.use(helmet());
  app.use(cors({ origin: env.cors.origin }));
  app.use(compression());
  if (!env.isTest) {
    app.use(morgan(env.isProd ? 'combined' : 'dev', { stream: morganStream }));
  }

  // Payment webhook needs the exact raw bytes for HMAC signature verification.
  // Must be registered before express.json() and scoped to this path only —
  // body-parser skips re-parsing a body that's already been consumed.
  app.use(`${env.apiBasePath}/payments/webhook`, express.raw({ type: '*/*', limit: '1mb' }));

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use(globalLimiter);

  app.get('/health', (req, res) => {
    res.json({ success: true, data: { status: 'ok', time: new Date().toISOString() }, error: null });
  });

  app.use(env.apiBasePath, routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
