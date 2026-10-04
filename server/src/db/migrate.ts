import fs from 'fs';
import path from 'path';
import { getPgClient, getMongoDb, closeDbConnections } from './index.js';

export async function runMigrations() {
  console.log('🚀 Running PostgreSQL migrations...');
  const client = await getPgClient();
  try {
    const migrationPath = path.resolve(__dirname, '../../../database/migrations/001_init.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await client.query(sql);
    console.log('✅ PostgreSQL schema created successfully.');

    console.log('🚀 Initializing MongoDB collections & indexes...');
    const db = await getMongoDb();
    const advisories = db.collection('advisories');
    await advisories.createIndex({ id: 1 }, { unique: true });
    await advisories.createIndex({ "affected.package.name": 1, "affected.package.ecosystem": 1 });
    await advisories.createIndex({ aliases: 1 });
    console.log('✅ MongoDB setup complete.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  runMigrations()
    .then(async () => {
      await closeDbConnections();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      await closeDbConnections();
      process.exit(1);
    });
}
