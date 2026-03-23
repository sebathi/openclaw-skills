#!/usr/bin/env node
// handle-callback.mjs — Process Telegram button callbacks
// Usage: node handle-callback.mjs <workspace> <action> <taskId> [extra]
// Actions: done, tomorrow, next_week, snooze (extra=duration), subtasks

import {
  resolveWorkspace, getBackend, openDB, todayStr,
  markDone, snoozeTo, reschedule, getPendingTasks,
  markDoneJSON, rescheduleJSON, loadConfig,
} from "./db.mjs";

const ws = resolveWorkspace(process.argv[2]);
const action = process.argv[3];
const taskId = parseInt(process.argv[4], 10);
const extra = process.argv[5];

if (!action || isNaN(taskId)) {
  console.error("Usage: node handle-callback.mjs <workspace> <action> <taskId> [extra]");
  process.exit(1);
}

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function nextMonday() {
  const d = new Date();
  const day = d.getDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + daysUntilMonday);
  return d.toISOString().slice(0, 10);
}

function parseDuration(dur) {
  const m = dur.match(/^(\d+)(m|h)$/);
  if (!m) return 30 * 60 * 1000;
  const val = parseInt(m[1], 10);
  return m[2] === "h" ? val * 3600000 : val * 60000;
}

async function main() {
  const backend = getBackend(ws);
  const today = todayStr();

  if (backend === "sqlite") {
    const db = await openDB(ws);
    if (!db) {
      console.error("Cannot open database");
      process.exit(1);
    }

    switch (action) {
      case "done":
        markDone(db, taskId, today);
        console.log(JSON.stringify({ ok: true, action: "done", taskId }));
        break;

      case "tomorrow":
        reschedule(db, taskId, addDays(1));
        console.log(JSON.stringify({ ok: true, action: "tomorrow", taskId, date: addDays(1) }));
        break;

      case "next_week":
        reschedule(db, taskId, nextMonday());
        console.log(JSON.stringify({ ok: true, action: "next_week", taskId, date: nextMonday() }));
        break;

      case "snooze": {
        if (!extra) {
          // Return snooze menu options
          const config = loadConfig(ws);
          console.log(JSON.stringify({
            ok: true,
            action: "snooze_menu",
            taskId,
            options: config.snoozeOptions,
          }));
        } else {
          const ms = parseDuration(extra);
          const until = new Date(Date.now() + ms).toISOString();
          snoozeTo(db, taskId, until);
          console.log(JSON.stringify({ ok: true, action: "snoozed", taskId, until }));
        }
        break;
      }

      case "subtasks": {
        const subtasks = db.prepare(
          "SELECT t.id, t.emoji, t.text, COALESCE(dt.done, 0) as done FROM tasks t LEFT JOIN daily_tasks dt ON dt.task_id = t.id AND dt.date = ? WHERE t.parent_id = ? AND t.active = 1"
        ).all(today, taskId);
        console.log(JSON.stringify({ ok: true, action: "subtasks", taskId, subtasks }));
        break;
      }

      default:
        console.error(`Unknown action: ${action}`);
        process.exit(1);
    }

    db.close();
  } else {
    // JSON backend — limited features
    switch (action) {
      case "done":
        markDoneJSON(ws, taskId);
        console.log(JSON.stringify({ ok: true, action: "done", taskId }));
        break;

      case "tomorrow":
        rescheduleJSON(ws, taskId, addDays(1));
        console.log(JSON.stringify({ ok: true, action: "tomorrow", taskId, date: addDays(1) }));
        break;

      case "next_week":
        rescheduleJSON(ws, taskId, nextMonday());
        console.log(JSON.stringify({ ok: true, action: "next_week", taskId, date: nextMonday() }));
        break;

      case "snooze":
        console.log(JSON.stringify({ ok: false, error: "Snooze not available in JSON mode" }));
        break;

      case "subtasks":
        console.log(JSON.stringify({ ok: false, error: "Subtasks not available in JSON mode" }));
        break;

      default:
        console.error(`Unknown action: ${action}`);
        process.exit(1);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
