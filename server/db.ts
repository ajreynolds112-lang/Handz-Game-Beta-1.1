import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@shared/schema';
import path from 'path';
import fs from 'fs';

// Store the DB file next to the app so data persists between sessions
function getDbPath(): string {
  // When running inside Electron, HANDZ_USER_DATA is set via env
  const userDataPath = process.env.HANDZ_USER_DATA || (global as any).__electronUserData;
  if (userDataPath) {
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    return path.join(userDataPath, 'handz.db');
  }
  // Fallback for dev
  return path.join(process.cwd(), 'handz.db');
}

const dbPath = getDbPath();
console.log('[db] using database at:', dbPath);
const sqlite = new Database(dbPath);

// Enable WAL mode for better performance
sqlite.pragma('journal_mode = WAL');

export const db = drizzle(sqlite, { schema });
