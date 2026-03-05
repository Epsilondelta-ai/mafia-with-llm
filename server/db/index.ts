import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', '..', 'mafia.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema();
  }
  return db;
}

function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS game_records (
      id TEXT PRIMARY KEY,
      started_at TEXT NOT NULL,
      ended_at TEXT NOT NULL,
      player_count INTEGER NOT NULL,
      winner TEXT NOT NULL,
      winner_text TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'play',
      total_turns INTEGER NOT NULL,
      players_json TEXT NOT NULL,
      events_json TEXT NOT NULL,
      chat_log_json TEXT NOT NULL DEFAULT '[]'
    );

    CREATE INDEX IF NOT EXISTS idx_game_records_started ON game_records(started_at DESC);
  `);

  // Migration: add chat_log_json column for existing databases
  try {
    db.exec(`ALTER TABLE game_records ADD COLUMN chat_log_json TEXT NOT NULL DEFAULT '[]'`);
  } catch {
    // Column already exists, ignore
  }
}

export function closeDb(): void {
  if (db) {
    db.close();
  }
}
