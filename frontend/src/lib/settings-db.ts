import Database from "better-sqlite3";
import path from "path";
import crypto from "crypto";

// Database stored alongside the project data (not in frontend build output)
const DB_PATH = path.join(process.cwd(), "..", "mythos_settings.sqlite");

// Encryption key derived from a machine-local secret
// In production, use a proper secret manager. For now, derive from env + salt.
const ENCRYPTION_KEY = crypto
  .createHash("sha256")
  .update(process.env.SETTINGS_ENCRYPTION_KEY || "mythos-alpha-local-key-2024")
  .digest();

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decrypt(encryptedText: string): string {
  const [ivHex, encrypted] = encryptedText.split(":");
  if (!ivHex || !encrypted) return "";
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

function getDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Create settings table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      encrypted INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  return db;
}

export function getSetting(key: string): string | null {
  const db = getDb();
  try {
    const row = db.prepare("SELECT value, encrypted FROM settings WHERE key = ?").get(key) as
      | { value: string; encrypted: number }
      | undefined;
    if (!row) return null;
    return row.encrypted ? decrypt(row.value) : row.value;
  } finally {
    db.close();
  }
}

export function setSetting(key: string, value: string, isSecret = false): void {
  const db = getDb();
  try {
    const storedValue = isSecret ? encrypt(value) : value;
    db.prepare(
      `INSERT INTO settings (key, value, encrypted, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, encrypted = excluded.encrypted, updated_at = datetime('now')`
    ).run(key, storedValue, isSecret ? 1 : 0);
  } finally {
    db.close();
  }
}

export function getSettings(keys: string[]): Record<string, string | null> {
  const db = getDb();
  try {
    const result: Record<string, string | null> = {};
    const stmt = db.prepare("SELECT value, encrypted FROM settings WHERE key = ?");
    for (const key of keys) {
      const row = stmt.get(key) as { value: string; encrypted: number } | undefined;
      result[key] = row ? (row.encrypted ? decrypt(row.value) : row.value) : null;
    }
    return result;
  } finally {
    db.close();
  }
}

export function deleteSetting(key: string): void {
  const db = getDb();
  try {
    db.prepare("DELETE FROM settings WHERE key = ?").run(key);
  } finally {
    db.close();
  }
}

// Check if a secret exists without revealing the value
export function hasSecret(key: string): boolean {
  const db = getDb();
  try {
    const row = db.prepare("SELECT 1 FROM settings WHERE key = ?").get(key);
    return !!row;
  } finally {
    db.close();
  }
}

// Get masked version of a secret (for display)
export function getMaskedSecret(key: string): string | null {
  const value = getSetting(key);
  if (!value) return null;
  if (value.length <= 8) return "****";
  return value.substring(0, 6) + "..." + value.substring(value.length - 4);
}
