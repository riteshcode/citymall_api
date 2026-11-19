import { env } from '../config/env.js';
import { passwordSchema } from '../utils/zodHelpers.js';

/** Fails BEFORE anything is written when the admin credentials are unusable. There is no default password. */
export function assertSeedAdminConfig() {
  const { adminPassword } = env.seed;
  if (!adminPassword) {
    if (env.isProd) {
      throw new Error('SEED_ADMIN_PASSWORD is required when NODE_ENV=production (there is no default password).');
    }
    return;
  }
  const check = passwordSchema.safeParse(adminPassword);
  if (!check.success) throw new Error(`SEED_ADMIN_PASSWORD is not acceptable: ${check.error.issues[0].message}`);
}
