---
name: daily-reminders
version: 2.1.0
description: Persistent daily reminder system with Telegram delivery, SQLite backend (Node.js), snooze, subtasks, and daily reports. Falls back to JSON if SQLite unavailable. Supports recurring and one-off tasks with interactive buttons.
---

# Daily Reminders v2.1.0

## Changelog

### v2.1.0 (2026-03-23)
- **fix:** `markDone` always closes task on today's date, removes any future-dated entry (e.g. task rescheduled to tomorrow and then marked done same day)
- **fix:** Historical stats and trend report now exclude future dates (`date <= today`)

### v2.0.0 (2026-03-23)
- Full rewrite with SQLite backend via `node:sqlite` (built-in Node ≥22.5)
- Interactive init script with SQLite detection and JSON fallback
- Per-task Telegram inline buttons: Done, Snooze, Tomorrow, Next week
- Configurable snooze durations
- Subtasks with parent_id relation
- Full action history (task_log) for procrastination tracking
- Daily report cron at 20:00 with completion stats and 7-day trend
- Migration script from v1 JSON format

### v1.0.0
- Basic daily task list via WhatsApp
- Check-off by replying a number
- Recurring tasks reset at midnight

A daily task management system for OpenClaw. Sends pending tasks via Telegram with interactive buttons (done, snooze, reschedule). Backed by SQLite with JSON fallback. All scripts are Node.js (v25, no external deps).

## How It Works

1. **SQLite database** (`memory/reminders.db`) — source of truth for tasks, daily status, and history
2. **JSON fallback** (`memory/recordatorios-hoy.json`) — used when SQLite is unavailable (limited features)
3. **Config** (`memory/reminders-config.json`) — backend choice, frequency, window, snooze options
4. **Reminder cron** — runs every N minutes in a time window, sends pending tasks via Telegram
5. **Reset cron** — runs at midnight, creates daily tasks for the new day, logs skipped tasks
6. **Report cron** — runs at 20:00, sends daily summary with completion stats

## Setup

```bash
node skills/daily-reminders/scripts/init.mjs /path/to/workspace
```

The init script will:
1. Detect SQLite availability (`node:sqlite` built-in or `better-sqlite3`)
2. Ask for reminder frequency, time window, and snooze options
3. Migrate existing `recordatorios-hoy.json` if present
4. Save config to `memory/reminders-config.json`

## Config File Schema

`memory/reminders-config.json`:
```json
{
  "backend": "sqlite",
  "frequencyMinutes": 30,
  "windowStart": 8,
  "windowEnd": 20,
  "snoozeOptions": ["30m", "1h", "2h", "4h"]
}
```

## Adding Tasks

### Recurring tasks
Tasks that reset daily. Tell the agent:
> "Add a recurring reminder to take my pill 💊"

The agent should call:
```bash
# Via db.mjs: addTask(db, { emoji: "💊", text: "Take pill", recurring: true })
```

### One-off tasks
Tasks that disappear once done:
> "Remind me to call the dentist"

### Subtasks (SQLite only)
> "Add subtask 'Pack clothes' to task 5"

```bash
# Via db.mjs: addSubtask(db, 5, { emoji: "👕", text: "Pack clothes" })
```

## Snooze

When a user presses 💤 Snooze on a task, send a follow-up message with buttons for each snooze duration from config:

| Button | Callback |
|--------|----------|
| 30 min | `task_snooze:ID:30m` |
| 1 hora | `task_snooze:ID:1h` |
| 2 horas | `task_snooze:ID:2h` |
| 4 horas | `task_snooze:ID:4h` |

Text command alternative: "snooze 3 2h" (snooze task 3 for 2 hours).

**JSON mode limitation:** Snooze is not available in JSON mode.

## Reports

### Automatic daily report (20:00)
Sent via the report cron. Shows completion percentage, done/pending breakdown, and a 7-day trend chart (SQLite only).

### On-demand
> "Show me my task report" or "How did I do this week?"

Use: `node skills/daily-reminders/scripts/daily-report.mjs /path/to/workspace`

## Callback Handling

When Telegram buttons are pressed, process via:
```bash
node skills/daily-reminders/scripts/handle-callback.mjs <workspace> <action> <taskId> [extra]
```

| Callback pattern | Action | Script args |
|-----------------|--------|-------------|
| `task_done:ID` | Mark done | `done ID` |
| `task_tomorrow:ID` | Reschedule to tomorrow | `tomorrow ID` |
| `task_next_week:ID` | Reschedule to next Monday | `next_week ID` |
| `task_snooze:ID` | Show snooze sub-menu | `snooze ID` |
| `task_snooze:ID:DURATION` | Snooze for duration | `snooze ID DURATION` |
| `task_subtasks:ID` | Show subtasks | `subtasks ID` |

## Scripts

All scripts accept workspace path as first argument or read `OPENCLAW_WORKSPACE` env var.

| Script | Purpose |
|--------|---------|
| `scripts/init.mjs` | Interactive setup |
| `scripts/migrate.mjs` | Migrate JSON → SQLite |
| `scripts/db.mjs` | Shared DB module (imported by other scripts) |
| `scripts/get-pending.mjs` | Output pending tasks as JSON |
| `scripts/reset-day.mjs` | Midnight reset logic |
| `scripts/daily-report.mjs` | Daily summary text |
| `scripts/handle-callback.mjs` | Process button callbacks |

## Cron Prompt Templates

### Reminder Cron — SQLite Backend

```
Schedule: */30 8-20 * * * (adjust frequency and window per config)
sessionTarget: isolated
delivery: none
```

```
Run: node {{workspace}}/skills/daily-reminders/scripts/get-pending.mjs {{workspace}}

If the output is an empty array [], reply ONLY: NO_REPLY.

Otherwise, for each task in the JSON array, send a Telegram message:
  channel: telegram
  to: 358425961

Message format:
  [emoji] [text]

With inline buttons:
  ✅ Hecho → callback_data: task_done:[id]
  💤 Snooze → callback_data: task_snooze:[id]
  📅 Mañana → callback_data: task_tomorrow:[id]
  📆 Próxima semana → callback_data: task_next_week:[id]

If the task has subtask_count > 0, add button:
  📎 Subtareas → callback_data: task_subtasks:[id]

Group all tasks into a single message if there are ≤5 tasks. Otherwise send individually.
No extra text beyond the task messages.
```

### Reminder Cron — JSON Backend

```
Schedule: */30 8-20 * * * (adjust per config)
sessionTarget: isolated
delivery: none
```

```
Read {{workspace}}/memory/recordatorios-hoy.json.
If 'date' is not today (YYYY-MM-DD), reply ONLY: NO_REPLY.
If all tasks have done=true, reply ONLY: NO_REPLY.
If there are tasks with done=false, send a Telegram message:
  channel: telegram
  to: 358425961

📋 Pendientes hoy:
[id]. [emoji] [text]
(only tasks with done=false)

With inline buttons per task:
  ✅ Hecho → callback_data: task_done:[id]
  📅 Mañana → callback_data: task_tomorrow:[id]
  📆 Próxima semana → callback_data: task_next_week:[id]

No extra text.
```

### Snooze Sub-Menu Prompt

When receiving callback `task_snooze:ID` (without duration):
```
Read {{workspace}}/memory/reminders-config.json for snoozeOptions.
Send a Telegram message:
  channel: telegram
  to: 358425961

💤 ¿Cuánto tiempo?

With inline buttons (one per snooze option):
  [duration label] → callback_data: task_snooze:[ID]:[duration]

E.g. for options ["30m","1h","2h","4h"]:
  30 min → task_snooze:3:30m
  1 hora → task_snooze:3:1h
  2 horas → task_snooze:3:2h
  4 horas → task_snooze:3:4h
```

### Reset Cron

```
Schedule: 0 0 * * *
sessionTarget: isolated
delivery: none
```

```
Run: node {{workspace}}/skills/daily-reminders/scripts/reset-day.mjs {{workspace}}
Reply ONLY: NO_REPLY.
```

### Report Cron

```
Schedule: 0 20 * * *
sessionTarget: isolated
delivery: none
```

```
Run: node {{workspace}}/skills/daily-reminders/scripts/daily-report.mjs {{workspace}}
Send the output as a Telegram message:
  channel: telegram
  to: 358425961
No extra text.
```

### Callback Handler Prompt

When receiving a callback from Telegram buttons matching `task_*`:
```
Parse the callback_data. Format: action:taskId[:extra]
Run: node {{workspace}}/skills/daily-reminders/scripts/handle-callback.mjs {{workspace}} [action] [taskId] [extra]

Read the JSON output.
If action was "snooze_menu", send the snooze sub-menu (see above).
If action was "subtasks", send the subtask list as a message.
Otherwise, send a brief confirmation (e.g. "✅ Listo" or "💤 Snooze 2h").
```

## JSON Backend Limitations

When using the JSON fallback (`backend: "json"`), the following features are **not available**:
- Snooze (requires timestamp tracking)
- Subtasks (requires relational parent_id)
- Historical stats and trend reports (no task_log table)
- Granular action logging

All other features (add, done, tomorrow, next week, daily report) work normally.

## DB Schema Reference

See `references/schema.md` for the full SQLite schema and JSON schema.

## API Design Note

All scripts expose a consistent interface (workspace path → JSON output) designed to be compatible with a future remote API (Fase 2). The `db.mjs` module exports functions that can be wrapped in HTTP handlers without modification.
