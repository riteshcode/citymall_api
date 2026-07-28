import crypto from 'crypto';

/** e.g. AALI2607271F3A9C */
export function generateOrderNumber() {
  const now = new Date();
  const datePart = `${now.getFullYear() % 100}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate()
  ).padStart(2, '0')}`;
  const randPart = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `AALI${datePart}${randPart}`;
}
