import pg from 'pg';
import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const pgPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://deplens_user:deplens_password@localhost:5432/deplens',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;

export async function getPgClient() {
  return await pgPool.connect();
}

export function getPgPool() {
  return pgPool;
}

export async function getMongoDb(): Promise<Db> {
  if (!mongoDb) {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/deplens';
    mongoClient = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await mongoClient.connect();
    mongoDb = mongoClient.db();
  }
  return mongoDb;
}

export async function closeDbConnections() {
  await pgPool.end();
  if (mongoClient) {
    await mongoClient.close();
    mongoClient = null;
    mongoDb = null;
  }
}
