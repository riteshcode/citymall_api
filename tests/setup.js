import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';

// A single-node replica set is required so order.service.js's
// session.withTransaction() calls work under test, same as production Mongo.
let replSet;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri(), { dbName: 'aali_market_test' });
}, 120000);

afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
}, 60000);
