// db.mjs — Shared database module for daily-reminders
// Supports SQLite (node:sqlite or better-sqlite3) and JSON fallback

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Workspace path resolution
// ---------------------------------------------------------------------------

export function resolveWorkspace(argv1) {
  const ws = argv1 || process.env.OPENCLAW_WORKSPACE;
  if (!ws) {
    console.error("Usage: node <script> <workspace-path>  (or set OPENCLAW_WORKSPACE)");
    process.exit(1);
  }
  return ws;
}

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

export function configPath(ws) {
  return join(ws, "memory", "reminders-config.json");
}

export function loadConfig(ws) {
  const p = configPath(ws);
  if (!existsSync(p)) {
    return {
      backend: "json",
      frequencyMinutes: 30,
      windowStart: 8,
      windowEnd: 20,
      snoozeOptions: ["30m", "1h", "2h", "4h"],
    };
  }
  return JSON.parse(readFileSync(p, "utf8"));
}

export function saveConfig(ws, cfg) {
  writeFileSync(configPath(ws), JSON.stringify(cfg, null, 2) + "\n");
}

// ---------------------------------------------------------------------------
// Backend detection
// ---------------------------------------------------------------------------

export function getBackend(ws) {
  return loadConfig(ws).backend || "json";
}

// ---------------------------------------------------------------------------
// SQLite helpers
// ---------------------------------------------------------------------------

let _DatabaseSync = null;

async function loadDatabaseSync() {
  if (_DatabaseSync) return _DatabaseSync;
  try {
    const mod = await import("node:sqlite");
    _DatabaseSync = mod.DatabaseSync;
    return _DatabaseSync;
  } catch {
    try {
      const mod = await import("better-sqlite3");
      // better-sqlite3 default export is the constructor
      _DatabaseSync = mod.default || mod;
      return _DatabaseSync;
    } catch {
      return null;
    }
  }
}

export async function openDB(ws) {
  const backend = getBackend(ws);
  if (backend !== "sqlite") return null;

  const DBClass = await loadDatabaseSync();
  if (!DBClass) return null;

  const dbPath = join(ws, "memory", "reminders.db");
  const db = new DBClass(dbPath);
  ensureSchema(db);
  return db;
}

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      emoji TEXT NOT NULL DEFAULT '📌',
      text TEXT NOT NULL,
      recurring INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      parent_id INTEGER REFERENCES tasks(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS daily_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id),
      date TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      snoozed_until TEXT,
      UNIQUE(task_id, date)
    );

    CREATE TABLE IF NOT EXISTS task_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id),
      action TEXT NOT NULL,
      scheduled_for TEXT,
      note TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

export function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function parseDuration(dur) {
  const m = dur.match(/^(\d+)(m|h)$/);
  if (!m) return 30 * 60 * 1000; // default 30m
  const val = parseInt(m[1], 10);
  return m[2] === "h" ? val * 3600000 : val * 60000;
}

// ---------------------------------------------------------------------------
// SQLite query helpers
// ---------------------------------------------------------------------------

export function ensureDailyTasks(db, date) {
  const existing = db.prepare("SELECT COUNT(*) as c FROM daily_tasks WHERE date = ?").get(date);
  if (existing.c > 0) return;

  const tasks = db.prepare("SELECT id FROM tasks WHERE active = 1 AND recurring = 1 AND parent_id IS NULL").all();
  const insert = db.prepare("INSERT OR IGNORE INTO daily_tasks (task_id, date, done) VALUES (?, ?, 0)");
  for (const t of tasks) {
    insert.run(t.id, date);
  }
}

export function getPendingTasks(db, date) {
  ensureDailyTasks(db, date);
  const now = new Date().toISOString();
  return db.prepare(`
    SELECT t.id, t.emoji, t.text, t.parent_id, dt.snoozed_until,
           (SELECT COUNT(*) FROM tasks sub WHERE sub.parent_id = t.id AND sub.active = 1) as subtask_count
    FROM daily_tasks dt
    JOIN tasks t ON t.id = dt.task_id
    WHERE dt.date = ? AND dt.done = 0
      AND (dt.snoozed_until IS NULL OR dt.snoozed_until <= ?)
    ORDER BY t.parent_id IS NOT NULL, t.id
  `).all(date, now);
}

export function markDone(db, taskId, date) {
  // Remove any future-dated entry for this task (e.g. rescheduled to tomorrow)
  db.prepare("DELETE FROM daily_tasks WHERE task_id = ? AND date > ?").run(taskId, date);
  // Upsert done=true for today
  db.prepare("INSERT OR REPLACE INTO daily_tasks (task_id, date, done) VALUES (?, ?, 1)").run(taskId, date);
  db.prepare("INSERT INTO task_log (task_id, action, scheduled_for) VALUES (?, 'done', ?)").run(taskId, date);
}

export function snoozeTo(db, taskId, until) {
  const date = todayStr();
  db.prepare("UPDATE daily_tasks SET snoozed_until = ? WHERE task_id = ? AND date = ?").run(until, taskId, date);
  db.prepare("INSERT INTO task_log (task_id, action, note) VALUES (?, 'snooze', ?)").run(taskId, until);
}

export function reschedule(db, taskId, newDate) {
  const today = todayStr();
  // Mark done for today (so it doesn't show again)
  db.prepare("UPDATE daily_tasks SET done = 1 WHERE task_id = ? AND date = ?").run(taskId, today);
  // Create entry for new date
  db.prepare("INSERT OR IGNORE INTO daily_tasks (task_id, date, done) VALUES (?, ?, 0)").run(taskId, newDate);
  db.prepare("INSERT INTO task_log (task_id, action, scheduled_for) VALUES (?, 'reschedule', ?)").run(taskId, newDate);
}

export function addTask(db, task) {
  const { emoji = "📌", text, recurring = 0, parentId = null } = task;
  const result = db.prepare(
    "INSERT INTO tasks (emoji, text, recurring, parent_id) VALUES (?, ?, ?, ?)"
  ).run(emoji, text, recurring ? 1 : 0, parentId);
  const id = result.lastInsertRowid ?? result.changes;
  // Also create today's daily_task entry
  const today = todayStr();
  db.prepare("INSERT OR IGNORE INTO daily_tasks (task_id, date, done) VALUES (?, ?, 0)").run(id, today);
  db.prepare("INSERT INTO task_log (task_id, action) VALUES (?, 'added')").run(id);
  return id;
}

export function addSubtask(db, parentId, task) {
  return addTask(db, { ...task, parentId });
}

export function getDailyStats(db, date) {
  const total = db.prepare("SELECT COUNT(*) as c FROM daily_tasks WHERE date = ?").get(date).c;
  const done = db.prepare("SELECT COUNT(*) as c FROM daily_tasks WHERE date = ? AND done = 1").get(date).c;
  const pending = total - done;
  const tasks = db.prepare(`
    SELECT t.emoji, t.text, dt.done
    FROM daily_tasks dt JOIN tasks t ON t.id = dt.task_id
    WHERE dt.date = ?
    ORDER BY dt.done, t.id
  `).all(date);
  return { date, total, done, pending, tasks };
}

export function getHistoricalStats(db) {
  const today = todayStr();
  return db.prepare(`
    SELECT date,
           COUNT(*) as total,
           SUM(done) as done,
           COUNT(*) - SUM(done) as pending
    FROM daily_tasks
    WHERE date <= ?
    GROUP BY date
    ORDER BY date DESC
    LIMIT 30
  `).all(today);
}

// ---------------------------------------------------------------------------
// JSON backend helpers
// ---------------------------------------------------------------------------

function jsonPath(ws) {
  return join(ws, "memory", "recordatorios-hoy.json");
}

export function loadJSON(ws) {
  const p = jsonPath(ws);
  if (!existsSync(p)) {
    return { date: todayStr(), tasks: [] };
  }
  return JSON.parse(readFileSync(p, "utf8"));
}

export function saveJSON(ws, data) {
  writeFileSync(jsonPath(ws), JSON.stringify(data, null, 2) + "\n");
}

export function getPendingTasksJSON(ws) {
  const data = loadJSON(ws);
  if (data.date !== todayStr()) return [];
  return data.tasks.filter((t) => !t.done);
}

export function markDoneJSON(ws, taskId) {
  const data = loadJSON(ws);
  const task = data.tasks.find((t) => t.id === taskId);
  if (task) task.done = true;
  saveJSON(ws, data);
}

export function rescheduleJSON(ws, taskId, newDate) {
  const data = loadJSON(ws);
  const task = data.tasks.find((t) => t.id === taskId);
  if (task) {
    task.done = true;
    task.scheduledFor = newDate;
  }
  saveJSON(ws, data);
}

export function addTaskJSON(ws, task) {
  const data = loadJSON(ws);
  const maxId = data.tasks.reduce((m, t) => Math.max(m, t.id), 0);
  const newTask = {
    id: maxId + 1,
    emoji: task.emoji || "📌",
    text: task.text,
    done: false,
    recurring: !!task.recurring,
  };
  data.tasks.push(newTask);
  saveJSON(ws, data);
  return newTask.id;
}

export function resetDayJSON(ws) {
  const data = loadJSON(ws);
  const today = todayStr();

  // Keep recurring tasks (reset done), bring forward scheduled tasks, remove expired one-offs
  const newTasks = [];
  for (const t of data.tasks) {
    if (t.recurring) {
      newTasks.push({ ...t, done: false });
    } else if (t.scheduledFor && t.scheduledFor >= today && !t.done) {
      newTasks.push(t);
    } else if (t.scheduledFor === today) {
      newTasks.push({ ...t, scheduledFor: undefined });
    }
    // non-recurring done tasks are dropped
  }

  saveJSON(ws, { date: today, tasks: newTasks });
}

export function getDailyStatsJSON(ws) {
  const data = loadJSON(ws);
  const total = data.tasks.length;
  const done = data.tasks.filter((t) => t.done).length;
  return { date: data.date, total, done, pending: total - done, tasks: data.tasks };
}
