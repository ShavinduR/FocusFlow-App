import { env } from './config/env.js';
import { connectDb, disconnectDb } from './db/connect.js';
import { createApp } from './app.js';

async function main() {
  const config = env();
  await connectDb(config.MONGODB_URI);

  const server = createApp().listen(config.PORT, () => {
    console.log(`FocusFlow API listening on :${config.PORT} (${config.NODE_ENV})`);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down…`);
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref(); // hard stop if connections hang
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
