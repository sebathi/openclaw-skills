#!/usr/bin/env node
// reset-day.mjs — Midnight reset: create daily_tasks for new day, log skipped tasks

import {
  resolveWorkspace, getBackend, openDB, todayStr,
  ensureDailyTasks, resetDayJSON,
} from "./db.mjs";

const ws = resolveWorkspace(process.argv[2]);

async function main() {
  const backend = getBackend(ws);
  const today = todayStr();

  if (backend === "sqlite") {
    const db = await openDB(ws);
    if (!db) {
      console.error("Cannot open database");
      process.exit(1);
    }

    // Log yesterday's incomplete tasks as skipped
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().slice(0, 10);

    const incomplete = db.prepare(
      "SELECT task_id FROM daily_tasks WHERE date = ? AND done = 0"
    ).all(yStr);

    const logSkip = db.prepare(
      "INSERT INTO task_log (task_id, action, scheduled_for) VALUES (?, 'skipped', ?)"
    );
    for (const row of incomplete) {
      logSkip.run(row.task_id, yStr);
    }

    // Create daily tasks for today
    ensureDailyTasks(db, today);

    // Also create entries for non-recurring tasks scheduled for today
    const scheduled = db.prepare(
      "SELECT task_id FROM daily_tasks WHERE date = ? AND done = 0"
    ).all(today);

    db.close();
    console.log(`Reset complete. ${incomplete.length} tasks skipped from yesterday. Today's tasks ready.`);
  } else {
    resetDayJSON(ws);
    console.log("JSON reset complete for " + today);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
