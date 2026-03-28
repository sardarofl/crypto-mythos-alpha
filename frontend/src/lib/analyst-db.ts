/**
 * Database layer for the AI Post-Trade Analyst system.
 * Manages 3 tables: trade_shadows, trade_analysis, pair_overrides.
 * Follows the same open/close pattern as settings-db.ts.
 */

import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "..", "mythos_settings.sqlite");

function getDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS trade_shadows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trade_id INTEGER NOT NULL UNIQUE,
      pair TEXT NOT NULL,
      open_rate REAL NOT NULL,
      close_rate REAL NOT NULL,
      close_timestamp INTEGER NOT NULL,
      exit_reason TEXT,
      profit_ratio REAL NOT NULL,
      stake_amount REAL NOT NULL,
      price_15m REAL,
      price_30m REAL,
      price_1h REAL,
      price_2h REAL,
      price_4h REAL,
      price_12h REAL,
      price_24h REAL,
      shadow_complete INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS trade_analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trade_id INTEGER NOT NULL UNIQUE,
      pair TEXT NOT NULL,
      classification TEXT NOT NULL,
      max_price_after REAL,
      max_profit_if_held REAL,
      recovery_time_minutes INTEGER,
      missed_upside_pct REAL,
      exit_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS pair_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pair TEXT NOT NULL,
      parameter_name TEXT NOT NULL,
      original_value REAL,
      recommended_value REAL NOT NULL,
      reasoning TEXT,
      confidence REAL,
      active INTEGER NOT NULL DEFAULT 0,
      source TEXT DEFAULT 'minimax',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(pair, parameter_name)
    )
  `);

  return db;
}

// ─── Trade Shadows ──────────────────────────────────────────

export interface ShadowRow {
  id: number;
  trade_id: number;
  pair: string;
  open_rate: number;
  close_rate: number;
  close_timestamp: number;
  exit_reason: string | null;
  profit_ratio: number;
  stake_amount: number;
  price_15m: number | null;
  price_30m: number | null;
  price_1h: number | null;
  price_2h: number | null;
  price_4h: number | null;
  price_12h: number | null;
  price_24h: number | null;
  shadow_complete: number;
  created_at: string;
  updated_at: string;
}

export function upsertShadow(data: {
  trade_id: number;
  pair: string;
  open_rate: number;
  close_rate: number;
  close_timestamp: number;
  exit_reason: string | null;
  profit_ratio: number;
  stake_amount: number;
}): void {
  const db = getDb();
  try {
    db.prepare(
      `INSERT OR IGNORE INTO trade_shadows
       (trade_id, pair, open_rate, close_rate, close_timestamp, exit_reason, profit_ratio, stake_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      data.trade_id, data.pair, data.open_rate, data.close_rate,
      data.close_timestamp, data.exit_reason, data.profit_ratio, data.stake_amount
    );
  } finally {
    db.close();
  }
}

export function getIncompleteShadows(): ShadowRow[] {
  const db = getDb();
  try {
    return db.prepare(
      "SELECT * FROM trade_shadows WHERE shadow_complete = 0"
    ).all() as ShadowRow[];
  } finally {
    db.close();
  }
}

export function getAllShadows(): ShadowRow[] {
  const db = getDb();
  try {
    return db.prepare(
      "SELECT * FROM trade_shadows ORDER BY close_timestamp DESC"
    ).all() as ShadowRow[];
  } finally {
    db.close();
  }
}

export function getTrackedTradeIds(): number[] {
  const db = getDb();
  try {
    const rows = db.prepare("SELECT trade_id FROM trade_shadows").all() as { trade_id: number }[];
    return rows.map(r => r.trade_id);
  } finally {
    db.close();
  }
}

// The shadow price columns and their offset in minutes
export const SHADOW_INTERVALS: { column: string; minutes: number }[] = [
  { column: "price_15m", minutes: 15 },
  { column: "price_30m", minutes: 30 },
  { column: "price_1h", minutes: 60 },
  { column: "price_2h", minutes: 120 },
  { column: "price_4h", minutes: 240 },
  { column: "price_12h", minutes: 720 },
  { column: "price_24h", minutes: 1440 },
];

export function updateShadowPrice(tradeId: number, column: string, price: number): void {
  const validColumns = SHADOW_INTERVALS.map(i => i.column);
  if (!validColumns.includes(column)) throw new Error(`Invalid shadow column: ${column}`);

  const db = getDb();
  try {
    db.prepare(
      `UPDATE trade_shadows SET ${column} = ?, updated_at = datetime('now') WHERE trade_id = ?`
    ).run(price, tradeId);
  } finally {
    db.close();
  }
}

export function markShadowComplete(tradeId: number): void {
  const db = getDb();
  try {
    db.prepare(
      "UPDATE trade_shadows SET shadow_complete = 1, updated_at = datetime('now') WHERE trade_id = ?"
    ).run(tradeId);
  } finally {
    db.close();
  }
}

// ─── Trade Analysis ─────────────────────────────────────────

export interface AnalysisRow {
  id: number;
  trade_id: number;
  pair: string;
  classification: string;
  max_price_after: number | null;
  max_profit_if_held: number | null;
  recovery_time_minutes: number | null;
  missed_upside_pct: number | null;
  exit_reason: string | null;
  created_at: string;
}

export function insertAnalysis(data: {
  trade_id: number;
  pair: string;
  classification: string;
  max_price_after: number | null;
  max_profit_if_held: number | null;
  recovery_time_minutes: number | null;
  missed_upside_pct: number | null;
  exit_reason: string | null;
}): void {
  const db = getDb();
  try {
    db.prepare(
      `INSERT OR IGNORE INTO trade_analysis
       (trade_id, pair, classification, max_price_after, max_profit_if_held, recovery_time_minutes, missed_upside_pct, exit_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      data.trade_id, data.pair, data.classification,
      data.max_price_after, data.max_profit_if_held,
      data.recovery_time_minutes, data.missed_upside_pct, data.exit_reason
    );
  } finally {
    db.close();
  }
}

export function getAllAnalyses(): AnalysisRow[] {
  const db = getDb();
  try {
    return db.prepare(
      "SELECT * FROM trade_analysis ORDER BY created_at DESC"
    ).all() as AnalysisRow[];
  } finally {
    db.close();
  }
}

export function getAnalyzedTradeIds(): number[] {
  const db = getDb();
  try {
    const rows = db.prepare("SELECT trade_id FROM trade_analysis").all() as { trade_id: number }[];
    return rows.map(r => r.trade_id);
  } finally {
    db.close();
  }
}

export function getCompletedUnanalyzedShadows(): ShadowRow[] {
  const db = getDb();
  try {
    return db.prepare(
      `SELECT s.* FROM trade_shadows s
       WHERE s.shadow_complete = 1
       AND s.trade_id NOT IN (SELECT trade_id FROM trade_analysis)`
    ).all() as ShadowRow[];
  } finally {
    db.close();
  }
}

// ─── Pair Overrides ─────────────────────────────────────────

export interface OverrideRow {
  id: number;
  pair: string;
  parameter_name: string;
  original_value: number | null;
  recommended_value: number;
  reasoning: string | null;
  confidence: number | null;
  active: number;
  source: string;
  created_at: string;
  updated_at: string;
}

export function upsertPairOverride(data: {
  pair: string;
  parameter_name: string;
  original_value: number | null;
  recommended_value: number;
  reasoning: string | null;
  confidence: number | null;
}): void {
  const db = getDb();
  try {
    db.prepare(
      `INSERT INTO pair_overrides (pair, parameter_name, original_value, recommended_value, reasoning, confidence)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(pair, parameter_name) DO UPDATE SET
         original_value = excluded.original_value,
         recommended_value = excluded.recommended_value,
         reasoning = excluded.reasoning,
         confidence = excluded.confidence,
         updated_at = datetime('now')`
    ).run(
      data.pair, data.parameter_name, data.original_value,
      data.recommended_value, data.reasoning, data.confidence
    );
  } finally {
    db.close();
  }
}

export function getAllOverrides(): OverrideRow[] {
  const db = getDb();
  try {
    return db.prepare(
      "SELECT * FROM pair_overrides ORDER BY pair, parameter_name"
    ).all() as OverrideRow[];
  } finally {
    db.close();
  }
}

export function getActiveOverrides(): OverrideRow[] {
  const db = getDb();
  try {
    return db.prepare(
      "SELECT * FROM pair_overrides WHERE active = 1 ORDER BY pair"
    ).all() as OverrideRow[];
  } finally {
    db.close();
  }
}

export function toggleOverride(id: number, active: boolean): void {
  const db = getDb();
  try {
    db.prepare(
      "UPDATE pair_overrides SET active = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(active ? 1 : 0, id);
  } finally {
    db.close();
  }
}

export function deleteAllOverrides(): void {
  const db = getDb();
  try {
    db.prepare("DELETE FROM pair_overrides").run();
  } finally {
    db.close();
  }
}
