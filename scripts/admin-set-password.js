// Sets (or resets) the password of an admin / rider account. Usage:
//   npm run admin:set-password -- <username>
//   npm run admin:set-password -- <username> --mobile 9999999999     (an older account that has no username yet)
// The new password is asked for twice in the terminal (not echoed). For a non-interactive shell set NEW_PASSWORD instead.
// Also clears a lock and signs the account out everywhere.
import readline from 'readline';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { recoverStaffAccount } from '../src/services/staff-auth.service.js';

function parseArgs(argv) {
  const args = { username: null, mobile: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--mobile') args.mobile = argv[++i];
    else if (a.startsWith('--mobile=')) args.mobile = a.slice('--mobile='.length);
    else if (!a.startsWith('-') && !args.username) args.username = a;
  }
  return args;
}

/** Reads one line from the terminal without echoing it. */
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const write = rl._writeToOutput;
    rl._writeToOutput = (text) => {
      if (text.startsWith(question)) write.call(rl, text);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  const { username, mobile } = parseArgs(process.argv.slice(2));
  if (!username) {
    console.error('Usage: npm run admin:set-password -- <username> [--mobile <mobile of an older account without a username>]');
    process.exit(1);
  }

  let password = process.env.NEW_PASSWORD;
  if (!password) {
    if (!process.stdin.isTTY) {
      console.error('No terminal to ask for the password: set NEW_PASSWORD in the environment.');
      process.exit(1);
    }
    password = await askHidden('New password: ');
    const again = await askHidden('Repeat the password: ');
    if (password !== again) {
      console.error('The two passwords do not match. Nothing was changed.');
      process.exit(1);
    }
  }

  await connectDB();
  try {
    const result = await recoverStaffAccount({ username, password, mobile });
    console.log(`Password set for ${result.role} "${result.username}" (${result.name}). They are signed out everywhere and any lock is cleared.`);
  } catch (err) {
    console.error(`Failed: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}

main();
