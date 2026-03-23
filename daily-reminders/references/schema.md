# tasks.json Schema

## Top-level fields

| Field | Type | Description |
|---|---|---|
| `date` | string (YYYY-MM-DD) | Today's date. Used by cron to detect stale files. |
| `tasks` | array | List of tasks for the day. |

## Task fields

| Field | Type | Description |
|---|---|---|
| `id` | number | Unique task identifier. Used by user to mark done ("reply 2"). |
| `emoji` | string | Visual indicator shown in the reminder list. |
| `text` | string | Short task description. |
| `done` | boolean | `true` = task completed today, silenced until next reset. |
| `recurring` | boolean | `true` = resets to `done: false` at midnight. `false` = removed at midnight. |

## Example

```json
{
  "date": "2026-03-23",
  "tasks": [
    {"id": 1, "emoji": "💊", "text": "Take pill", "done": false, "recurring": true},
    {"id": 2, "emoji": "🏃", "text": "Go for a run", "done": false, "recurring": true},
    {"id": 3, "emoji": "📞", "text": "Call dentist", "done": false, "recurring": false}
  ]
}
```

## ID assignment rules

- IDs must be unique within the file
- When adding a new task, use `max(existing ids) + 1`
- IDs are stable within a day; after midnight reset, recurring tasks keep their IDs

## Midnight reset logic

```
for each task in tasks:
  if recurring == true:
    task.done = false
  else:
    remove task from list
set date = today
```
