import { getDb } from './index.js';
import type { GameRecord, GameRecordPlayer, Team, GameMode, GameEvent, ChatMessage } from '../../shared/types.js';

export function saveGameRecord(
  id: string,
  winner: Team,
  mode: GameMode,
  totalTurns: number,
  players: GameRecordPlayer[],
  events: GameEvent[],
  chatLog: ChatMessage[],
  startedAt: string,
): void {
  const db = getDb();
  const winnerText = winner === 'citizen_team' ? '시민 진영 승리' : '마피아 진영 승리';

  db.prepare(`
    INSERT INTO game_records (id, started_at, ended_at, player_count, winner, winner_text, mode, total_turns, players_json, events_json, chat_log_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    startedAt,
    new Date().toISOString(),
    players.length,
    winner,
    winnerText,
    mode,
    totalTurns,
    JSON.stringify(players),
    JSON.stringify(events),
    JSON.stringify(chatLog),
  );
}

export function getGameRecords(limit = 50, offset = 0): GameRecord[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM game_records ORDER BY started_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset) as any[];

  return rows.map(mapRow);
}

export function getGameRecord(id: string): GameRecord | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM game_records WHERE id = ?').get(id) as any;
  return row ? mapRow(row) : null;
}

export function deleteGameRecord(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM game_records WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getGameStats() {
  const db = getDb();
  const total = (db.prepare('SELECT COUNT(*) as count FROM game_records').get() as any).count;
  const citizenWins = (db.prepare("SELECT COUNT(*) as count FROM game_records WHERE winner = 'citizen_team'").get() as any).count;
  const mafiaWins = (db.prepare("SELECT COUNT(*) as count FROM game_records WHERE winner = 'mafia_team'").get() as any).count;

  return { total, citizenWins, mafiaWins };
}

function mapRow(row: any): GameRecord {
  return {
    id: row.id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    playerCount: row.player_count,
    winner: row.winner as Team,
    winnerText: row.winner_text,
    mode: row.mode as GameMode,
    totalTurns: row.total_turns,
    players: JSON.parse(row.players_json),
    events: JSON.parse(row.events_json || '[]'),
    chatLog: JSON.parse(row.chat_log_json || '[]'),
  };
}
