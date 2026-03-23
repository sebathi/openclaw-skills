---
name: daily-reminders
description: Set up a persistent daily reminder system with a numbered task list delivered via WhatsApp. Tasks are checked off by number, recur daily, and one-off reminders auto-expire. Use when the user wants a recurring reminder system, asks to "remind me to do X every day", wants a todo/checklist sent periodically, or wants to track daily tasks with check-off confirmation.
---

# Daily Reminders

A daily task list system for OpenClaw. Sends a numbered pending list via WhatsApp every 30 minutes (configurable window). Users reply with a number to mark tasks done. Recurring tasks reset at midnight; one-off tasks expire when done.

## How It Works

1. **Task list file** (`memory/tasks.json`) — source of truth for today's tasks
2. **Reminder cron** — runs every 30 min in a time window, sends pending tasks
3. **Reset cron** — runs at midnight, resets recurring tasks and removes one-off tasks
4. **User confirms** by replying a number → agent updates the file

## Setup

### 1. Create the task list file

Create `memory/tasks.json` in the workspace:

```json
{
  "date": "YYYY-MM-DD",
  "tasks": [
    {"id": 1, "emoji": "💊", "text": "Take pill", "done": false, "recurring": true},
    {"id": 2, "emoji": "📞", "text": "Call John", "done": false, "recurring": false}
  ]
}
```

- `recurring: true` → resets to `done: false` each midnight
- `recurring: false` → removed at midnight (one-off)
- `done: true` → silenced until reset

### 2. Create the reminder cron

```
Schedule: */30 8-20 * * * (TZ: user's timezone)
sessionTarget: isolated
delivery: none
```

Payload prompt:
```
Read /path/to/workspace/memory/tasks.json.
If 'date' is not today (YYYY-MM-DD), reply ONLY: NO_REPLY.
If today and all tasks have done=true, reply ONLY: NO_REPLY.
If there are tasks with done=false, use the message tool
(action=send, channel=whatsapp, to=USER_NUMBER) to send exactly:

📋 Pending today:
[number]. [emoji] [text]
(only tasks with done=false)

Reply with the number to mark as done.

No extra text.
```

### 3. Create the midnight reset cron

```
Schedule: 0 0 * * * (TZ: user's timezone)
sessionTarget: isolated
delivery: none
```

Payload prompt:
```
Read /path/to/workspace/memory/tasks.json.
Update for the new day:
1. Set 'date' to today (YYYY-MM-DD)
2. For each task with recurring=true, set done=false
3. Remove all tasks with recurring=false
Save the file. Reply ONLY: NO_REPLY.
```

> **Note:** WhatsApp inline buttons only work with the official Business API. With personal WhatsApp (Baileys bridge), use the numbered list format instead.

### 4. Handle user confirmations

When the user replies with a number (e.g. "1", "done 2", "1 and 3"):
- Read `tasks.json`
- Set `done: true` for the matching task(s)
- Save the file
- Confirm which tasks are now done and which remain

## Adding One-Off Reminders

When the user says "remind me to X":
1. Read `tasks.json`
2. Add a new task with the next available `id`, appropriate emoji, and `recurring: false`
3. Save the file
4. Confirm it was added — it will appear in the next reminder cycle

## Customization

| Parameter | Default | Notes |
|---|---|---|
| Frequency | `*/30` | Change to `*/15` for 15-min, `0 *` for hourly |
| Window start | `8` | Hour (24h) to start sending |
| Window end | `20` | Hour (24h) to stop (last run at HH:30) |
| Reset time | `0 0` | Midnight; change if needed |

## File Schema Reference

See `references/schema.md` for the full JSON schema and field descriptions.
