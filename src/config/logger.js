import winston from 'winston';
import { env } from './env.js';

export const logger = winston.createLogger({
  level: env.isProd ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    env.isProd
      ? winston.format.json()
      : winston.format.combine(winston.format.colorize(), winston.format.simple())
  ),
  transports: [new winston.transports.Console({ silent: env.isTest })],
});

export const morganStream = {
  write: (message) => logger.info(message.trim()),
};
