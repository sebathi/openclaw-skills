# daily-reminders

An [OpenClaw](https://openclaw.ai) skill that sets up a persistent daily reminder system delivered via WhatsApp (or any supported channel).

## What it does

- Sends a **numbered pending task list** every 30 minutes between 8am and 8pm
- User replies with a number to mark tasks as done → silence for that task
- **Recurring tasks** reset automatically at midnight
- **One-off reminders** ("remind me to call X") are added on demand and removed once done

## Example interaction

```
📋 Pending today:
1. 💊 Take pill
2. 📞 Call dentist
3. 🏃 Go for a run

Reply with the number to mark as done.
```

User replies `1` → task 1 is checked off and won't appear again today.

## How it works

| Component | Description |
|---|---|
| `memory/tasks.json` | Source of truth for today's tasks |
| Reminder cron (`*/30 8-20 * * *`) | Sends pending tasks every 30 min |
| Reset cron (`0 0 * * *`) | Resets recurring tasks, removes one-off tasks |

## Installation

### Option 1 — ClawHub CLI

```bash
clawhub install daily-reminders
```

### Option 2 — Manual

1. Clone or download this folder into your OpenClaw skills directory:
   ```bash
   git clone https://github.com/sebathi/openclaw-skills
   cp -r openclaw-skills/daily-reminders /path/to/openclaw/skills/
   ```

2. In OpenClaw, tell the agent to set up the skill:
   > "Set up the daily-reminders skill for me"

   The agent will read SKILL.md and walk you through creating the task file and cron jobs.

### Option 3 — Direct config

Copy the cron payloads from [SKILL.md](SKILL.md) and create the jobs manually via the OpenClaw cron manager.

## Adding it to OpenClaw config

Point your OpenClaw skills path to the folder containing this skill:

```yaml
skills:
  paths:
    - /path/to/openclaw-skills
```

Or if using the default skills directory, just drop the folder there — OpenClaw picks it up automatically on restart.

## Setup

See [SKILL.md](SKILL.md) for full setup instructions including cron payloads and JSON schema.

## Customization

| Parameter | Default | Change to |
|---|---|---|
| Frequency | every 30 min | `*/15` for 15 min, `0 *` for hourly |
| Window | 8am–8pm | Edit the `8-20` in the cron expression |
| Channel | WhatsApp | Any channel supported by OpenClaw |

## License

MIT
