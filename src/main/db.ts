import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Observation, TimelineCard } from '../shared/types'
import { isValidCategory } from '../shared/categories'

export interface ScreenshotRow {
  id: number
  ts: number
  path: string
}

/**
 * Local journal database. Uses Node's built-in SQLite (node:sqlite,
 * available in Electron ≥ 36) so the app has no native npm dependencies.
 */
export class JournalDb {
  private db: DatabaseSync

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true })
    this.db = new DatabaseSync(dbPath)
    this.db.exec('PRAGMA journal_mode = WAL')
    this.migrate()
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS screenshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts INTEGER NOT NULL,
        path TEXT NOT NULL,
        analyzed INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_screenshots_analyzed ON screenshots (analyzed, ts);
      CREATE TABLE IF NOT EXISTS observations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        day TEXT NOT NULL,
        start_ts INTEGER NOT NULL,
        end_ts INTEGER NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        category TEXT NOT NULL,
        distraction INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_observations_day ON observations (day);
      CREATE TABLE IF NOT EXISTS cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        day TEXT NOT NULL,
        start_ts INTEGER NOT NULL,
        end_ts INTEGER NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        category TEXT NOT NULL,
        distraction INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_cards_day ON cards (day, start_ts);
      CREATE TABLE IF NOT EXISTS summaries (
        day TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        generated_at INTEGER NOT NULL
      );
    `)
  }

  close(): void {
    this.db.close()
  }

  // --- screenshots ---

  insertScreenshot(ts: number, path: string): void {
    this.db.prepare('INSERT INTO screenshots (ts, path) VALUES (?, ?)').run(ts, path)
  }

  listUnanalyzed(beforeTs: number): ScreenshotRow[] {
    const rows = this.db
      .prepare('SELECT id, ts, path FROM screenshots WHERE analyzed = 0 AND ts <= ? ORDER BY ts')
      .all(beforeTs) as unknown as ScreenshotRow[]
    return rows
  }

  countUnanalyzed(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM screenshots WHERE analyzed = 0').get() as
      | { n: number }
      | undefined
    return row?.n ?? 0
  }

  markAnalyzed(ids: number[]): void {
    if (ids.length === 0) return
    const stmt = this.db.prepare('UPDATE screenshots SET analyzed = 1 WHERE id = ?')
    for (const id of ids) stmt.run(id)
  }

  countScreenshotsForDay(startTs: number, endTs: number): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS n FROM screenshots WHERE ts >= ? AND ts < ?')
      .get(startTs, endTs) as { n: number } | undefined
    return row?.n ?? 0
  }

  /** Delete screenshot rows older than a timestamp; returns their file paths. */
  deleteScreenshotsBefore(ts: number): string[] {
    const rows = this.db
      .prepare('SELECT path FROM screenshots WHERE ts < ?')
      .all(ts) as unknown as Array<{ path: string }>
    this.db.prepare('DELETE FROM screenshots WHERE ts < ?').run(ts)
    return rows.map((r) => r.path)
  }

  // --- observations ---

  insertObservations(day: string, observations: Observation[]): void {
    const stmt = this.db.prepare(
      `INSERT INTO observations (day, start_ts, end_ts, title, summary, category, distraction)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    for (const o of observations) {
      stmt.run(day, o.startTs, o.endTs, o.title, o.summary, o.category, o.distraction ? 1 : 0)
    }
  }

  // --- cards ---

  getCards(day: string): TimelineCard[] {
    const rows = this.db
      .prepare(
        'SELECT id, day, start_ts, end_ts, title, summary, category, distraction FROM cards WHERE day = ? ORDER BY start_ts'
      )
      .all(day) as unknown as Array<{
      id: number
      day: string
      start_ts: number
      end_ts: number
      title: string
      summary: string
      category: string
      distraction: number
    }>
    return rows.map((r) => ({
      id: r.id,
      day: r.day,
      startTs: r.start_ts,
      endTs: r.end_ts,
      title: r.title,
      summary: r.summary,
      category: isValidCategory(r.category) ? r.category : 'other',
      distraction: r.distraction === 1
    }))
  }

  replaceDayCards(day: string, cards: TimelineCard[]): void {
    this.db.prepare('DELETE FROM cards WHERE day = ?').run(day)
    const stmt = this.db.prepare(
      `INSERT INTO cards (day, start_ts, end_ts, title, summary, category, distraction)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    for (const c of cards) {
      stmt.run(day, c.startTs, c.endTs, c.title, c.summary, c.category, c.distraction ? 1 : 0)
    }
  }

  listDays(): string[] {
    const rows = this.db
      .prepare('SELECT DISTINCT day FROM cards ORDER BY day DESC')
      .all() as unknown as Array<{ day: string }>
    return rows.map((r) => r.day)
  }

  // --- summaries ---

  getSummary(day: string): string | null {
    const row = this.db.prepare('SELECT text FROM summaries WHERE day = ?').get(day) as
      | { text: string }
      | undefined
    return row?.text ?? null
  }

  setSummary(day: string, text: string): void {
    this.db
      .prepare(
        `INSERT INTO summaries (day, text, generated_at) VALUES (?, ?, ?)
         ON CONFLICT(day) DO UPDATE SET text = excluded.text, generated_at = excluded.generated_at`
      )
      .run(day, text, Date.now())
  }
}
