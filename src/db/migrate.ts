import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import { MIGRATIONS } from './schema';

/** Passed to <SQLiteProvider onInit>. Runs pending migrations using PRAGMA user_version. */
export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  if (Platform.OS !== 'web') await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  while (version < MIGRATIONS.length) {
    const sql = MIGRATIONS[version];
    await db.withTransactionAsync(async () => {
      await db.execAsync(sql);
    });
    version += 1;
    await db.execAsync(`PRAGMA user_version = ${version}`);
  }
}
