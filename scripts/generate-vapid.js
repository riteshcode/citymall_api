// Prints a fresh VAPID key pair for Web Push. Run once, put the values in .env, and NEVER commit the private key.
// Changing the keys later invalidates every existing browser subscription.
import { generateVAPIDKeys } from 'web-push';

const { publicKey, privateKey } = generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log('VAPID_SUBJECT=mailto:you@your-domain.com');
