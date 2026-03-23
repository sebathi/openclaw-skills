# openclaw-skills

A collection of [OpenClaw](https://openclaw.ai) skills by [@sebathi](https://github.com/sebathi).

## Skills

| Skill | Description |
|---|---|
| [daily-reminders](./daily-reminders) | Daily task list with WhatsApp check-off by number |

## Installation

### Via ClawHub

```bash
clawhub install <skill-name>
```

### Manual

Clone this repo and point OpenClaw to the directory:

```bash
git clone https://github.com/sebathi/openclaw-skills
```

Then add to your OpenClaw config:

```yaml
skills:
  paths:
    - /path/to/openclaw-skills
```

Or copy individual skill folders into your existing skills directory.

## Contributing

PRs welcome. Each skill lives in its own folder with a `SKILL.md` following the [AgentSkills spec](https://clawhub.com/docs).
