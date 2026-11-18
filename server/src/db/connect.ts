import mongoose from 'mongoose';

export async function connectDb(uri: string) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  // Build indexes declared in schemas (idempotent). In very large deployments,
  // prefer building indexes out-of-band and set autoIndex: false.
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
