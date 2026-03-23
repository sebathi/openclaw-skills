# Schema Reference — Daily Reminders v2

## SQLite Schema

Database file: `memory/reminders.db`

### tasks

Master list of all tasks (recurring and one-off).

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  emoji TEXT NOT NULL DEFAULT '📌',
  text TEXT NOT NULL,
  recurring INTEGER NOT NULL DEFAULT 0,  -- 1 = resets daily, 0 = one-off
  active INTEGER NOT NULL DEFAULT 1,     -- 0 = soft-deleted
  parent_id INTEGER REFERENCES tasks(id), -- NULL = top-level, set = subtask
  created_at TEXT DEFAULT (datetime('now'))
);
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-incrementing task ID |
| `emoji` | TEXT | Visual indicator (default 📌) |
| `text` | TEXT | Task description |
| `recurring` | INTEGER | 1 = recurring daily, 0 = one-off |
| `active` | INTEGER | 1 = active, 0 = soft-deleted |
| `parent_id` | INTEGER | References `tasks(id)` for subtasks, NULL for top-level |
| `created_at` | TEXT | ISO datetime of creation |

### daily_tasks

Per-day status for each task. Created by the midnight reset cron.

```sql
CREATE TABLE IF NOT EXISTS daily_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id),
  date TEXT NOT NULL,            -- YYYY-MM-DD
  done INTEGER NOT NULL DEFAULT 0,
  snoozed_until TEXT,            -- ISO datetime, NULL = not snoozed
  UNIQUE(task_id, date)
);
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-incrementing row ID |
| `task_id` | INTEGER FK | References `tasks(id)` |
| `date` | TEXT | Date this entry is for (YYYY-MM-DD) |
| `done` | INTEGER | 1 = completed, 0 = pending |
| `snoozed_until` | TEXT | ISO datetime when snooze expires, NULL if not snoozed |

Unique constraint on `(task_id, date)` prevents duplicate entries.

### task_log

Audit trail of all actions taken on tasks.

```sql
CREATE TABLE IF NOT EXISTS task_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id),
  action TEXT NOT NULL,
  scheduled_for TEXT,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-incrementing log ID |
| `task_id` | INTEGER FK | References `tasks(id)` |
| `action` | TEXT | One of: `done`, `tomorrow`, `next_week`, `snooze`, `reset`, `skipped`, `added`, `subtask_added`, `reschedule` |
| `scheduled_for` | TEXT | Target date for reschedule/schedule actions |
| `note` | TEXT | Extra info (e.g. snooze duration) |
| `created_at` | TEXT | ISO datetime of action |

## JSON Schema (Fallback Mode)

File: `memory/recordatorios-hoy.json`

```json
{
  "date": "YYYY-MM-DD",
  "tasks": [
    {
      "id": 1,
      "emoji": "💊",
      "text": "Take pill",
      "done": false,
      "recurring": true,
      "scheduledFor": null
    }
  ]
}
```

### Top-level fields

| Field | Type | Description |
|-------|------|-------------|
| `date` | string | Today's date (YYYY-MM-DD). Used to detect stale files. |
| `tasks` | array | List of tasks for the day. |

### Task fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Unique task ID. Used in callbacks. |
| `emoji` | string | Visual indicator. |
| `text` | string | Task description. |
| `done` | boolean | `true` = completed today. |
| `recurring` | boolean | `true` = resets at midnight. `false` = removed when done. |
| `scheduledFor` | string? | YYYY-MM-DD date if rescheduled for a future day. |

### JSON limitations

- No snooze (no timestamp tracking within a flat file)
- No subtasks (no relational structure)
- No historical stats (no log table)
- No granular action logging

## Config Schema

File: `memory/reminders-config.json`

```json
{
  "backend": "sqlite",
  "frequencyMinutes": 30,
  "windowStart": 8,
  "windowEnd": 20,
  "snoozeOptions": ["30m", "1h", "2h", "4h"]
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `backend` | string | `"json"` | `"sqlite"` or `"json"` |
| `frequencyMinutes` | number | `30` | Reminder frequency in minutes |
| `windowStart` | number | `8` | Hour (0-23) to start sending reminders |
| `windowEnd` | number | `20` | Hour (0-23) to stop sending reminders |
| `snoozeOptions` | string[] | `["30m","1h","2h","4h"]` | Available snooze durations |
