#!/usr/bin/env node
// get-pending.mjs — Output pending tasks as JSON array

import {
  resolveWorkspace, getBackend, openDB, getPendingTasks,
  getPendingTasksJSON, todayStr, loadConfig,
} from "./db.mjs";

const ws = resolveWorkspace(process.argv[2]);

async function main() {
  const backend = getBackend(ws);
  const config = loadConfig(ws);
  const now = new Date();
  const hour = now.getHours();

  // Respect time window
  if (hour < config.windowStart || hour >= config.windowEnd) {
    console.log("[]");
    return;
  }

  let tasks;
  if (backend === "sqlite") {
    const db = await openDB(ws);
    if (!db) {
      console.error("Cannot open database");
      process.exit(1);
    }
    tasks = getPendingTasks(db, todayStr());
    db.close();
  } else {
    tasks = getPendingTasksJSON(ws).map((t) => ({
      id: t.id,
      emoji: t.emoji,
      text: t.text,
      parent_id: null,
      snoozed_until: null,
      subtask_count: 0,
    }));
  }

  console.log(JSON.stringify(tasks, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
