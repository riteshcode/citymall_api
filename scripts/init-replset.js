// One-time helper: turns a local standalone mongod (already started with `replication.replSetName: rs0`)
// into a single-node replica set. Needed because POST /orders uses multi-document transactions.
// Usage: npm run db:init-replset
import mongoose from 'mongoose';

const HOST = process.env.MONGO_HOST || '127.0.0.1:27017';
const SET_NAME = process.env.MONGO_REPLSET || 'rs0';

await mongoose.connect(`mongodb://${HOST}/?directConnection=true`, { serverSelectionTimeoutMS: 5000 });
const admin = mongoose.connection.db.admin();

try {
  const status = await admin.command({ replSetGetStatus: 1 });
  console.log(`Already a replica set: "${status.set}" (state ${status.myState === 1 ? 'PRIMARY' : status.myState}). Nothing to do.`);
} catch (err) {
  if (err.codeName === 'NotYetInitialized') {
    await admin.command({ replSetInitiate: { _id: SET_NAME, members: [{ _id: 0, host: HOST }] } });
    console.log(`Initiated replica set "${SET_NAME}" with member ${HOST}. Wait ~5s for PRIMARY, then restart the API.`);
  } else if (err.codeName === 'NoReplicationEnabled') {
    console.error('mongod is running WITHOUT --replSet. Add to mongod.cfg:\n\nreplication:\n  replSetName: rs0\n\nthen restart the MongoDB service and re-run this script.');
    process.exitCode = 1;
  } else {
    throw err;
  }
}

await mongoose.disconnect();
