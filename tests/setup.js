import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';

// A single-node replica set is required so order.service.js's
// session.withTransaction() calls work under test, same as production Mongo.
let replSet;

// mongodb-memory-server picks a random free port. On Windows that port can fall inside a range reserved
// by Hyper-V/WinNAT and fail with EACCES, so retry with a fresh port instead of failing the whole file.
async function startReplSet(attempts = 5) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

beforeAll(async () => {
  replSet = await startReplSet();
  await mongoose.connect(replSet.getUri(), { dbName: 'aali_market_test' });
}, 180000);

afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
}, 60000);
