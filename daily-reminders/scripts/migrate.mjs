#!/usr/bin/env node
// migrate.mjs — Migrate recordatorios-hoy.json → SQLite

import { readFileSync, renameSync, existsSync } from "node:fs";
import { join } from "node:path";
import { resolveWorkspace, openDB, todayStr, saveConfig, loadConfig } from "./db.mjs";

const ws = resolveWorkspace(process.argv[2]);

async function main() {
  const oldPath = join(ws, "memory", "recordatorios-hoy.json");

  if (!existsSync(oldPath)) {
    console.log("No recordatorios-hoy.json found. Nothing to migrate.");
    process.exit(0);
  }

  // Ensure backend is sqlite in config
  const cfg = loadConfig(ws);
  if (cfg.backend !== "sqlite") {
    cfg.backend = "sqlite";
    saveConfig(ws, cfg);
  }

  const db = await openDB(ws);
  if (!db) {
    console.error("Cannot open SQLite database. Run init.mjs first.");
    process.exit(1);
  }

  const raw = readFileSync(oldPath, "utf8");
  const data = JSON.parse(raw);
  const today = data.date || todayStr();

  console.log(`Migrating ${data.tasks.length} tasks from ${oldPath}...`);

  const insertTask = db.prepare(
    "INSERT INTO tasks (emoji, text, recurring, active) VALUES (?, ?, ?, 1)"
  );
  const insertDaily = db.prepare(
    "INSERT OR IGNORE INTO daily_tasks (task_id, date, done) VALUES (?, ?, ?)"
  );
  const insertLog = db.prepare(
    "INSERT INTO task_log (task_id, action, scheduled_for) VALUES (?, 'added', ?)"
  );

  for (const t of data.tasks) {
    const result = insertTask.run(t.emoji || "📌", t.text, t.recurring ? 1 : 0);
    const newId = result.lastInsertRowid;

    // Create daily_task for the task's date
    const taskDate = t.scheduledFor || today;
    insertDaily.run(newId, taskDate, t.done ? 1 : 0);
    insertLog.run(newId, taskDate);

    console.log(`  ✔ ${t.emoji} ${t.text} (id=${newId}, date=${taskDate}, done=${t.done})`);
  }

  // Rename old file
  const bakPath = oldPath + ".bak";
  renameSync(oldPath, bakPath);
  console.log(`\n✔ Migration complete. Old file renamed to ${bakPath}`);
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
