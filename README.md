# openclaw-skills

A collection of [OpenClaw](https://openclaw.ai) skills by [@sebathi](https://github.com/sebathi).

## Skills

| Skill | Version | Description |
|---|---|---|
| [daily-reminders](./daily-reminders) | v2.1.0 | Daily task manager with Telegram delivery, SQLite backend (Node.js), snooze, subtasks, and procrastination reports |

## daily-reminders v2.1.0

A daily task management system for OpenClaw. Sends pending tasks via Telegram with interactive inline buttons. Backed by SQLite (Node.js built-in) with JSON fallback.

**Features:**
- ✅ Per-task inline buttons: Done, Snooze, Tomorrow, Next week
- 💤 Configurable snooze durations (30m, 1h, 2h, 4h, or custom)
- 📎 Subtasks with parent–child relationships
- 📊 Daily report at 20:00 with completion stats and 7-day trend
- 🗃️ Full action history (done, snooze, postponed) for procrastination tracking
- 🔄 JSON fallback when SQLite is unavailable (limited features)

**Setup:**
```bash
node skills/daily-reminders/scripts/init.mjs /path/to/workspace
```

The init script detects SQLite availability, asks for your preferences (frequency, time window, snooze options), and migrates any existing task data.

**Requirements:** Node.js ≥ 22.5 (for `node:sqlite` built-in). Older Node falls back to `better-sqlite3` (auto-install offered) or JSON mode.

## Changelog

### daily-reminders v2.1.0 (2026-03-23)
- **fix:** `markDone` always closes task on today's date, removes any future-dated entry (e.g. task rescheduled to tomorrow and then marked done same day)
- **fix:** Historical stats and daily report now exclude future dates

### daily-reminders v2.0.0 (2026-03-23)
- Full rewrite with SQLite backend via `node:sqlite` (built-in Node ≥22.5)
- Interactive init script with SQLite detection and JSON fallback
- Per-task Telegram inline buttons: Done, Snooze, Tomorrow, Next week
- Configurable snooze durations
- Subtasks with parent_id relation
- Full action history (task_log) for procrastination tracking
- Daily report cron at 20:00 with completion stats and 7-day trend
- Migration script from v1 JSON format

### daily-reminders v1.0.0
- Basic daily task list via WhatsApp
- Check-off by replying a number
- Recurring tasks reset at midnight

## Installation

### Via ClawHub

```bash
clawhub install <skill-name>
```

### Manual

Clone this repo and copy the skill folder into your OpenClaw workspace:

```bash
git clone https://github.com/sebathi/openclaw-skills
cp -r openclaw-skills/daily-reminders ~/.openclaw/workspace/skills/
```

Then run the init script:

```bash
node ~/.openclaw/workspace/skills/daily-reminders/scripts/init.mjs ~/.openclaw/workspace
```

## Contributing

PRs welcome. Each skill lives in its own folder with a `SKILL.md` following the [AgentSkills spec](https://clawhub.com/docs).
