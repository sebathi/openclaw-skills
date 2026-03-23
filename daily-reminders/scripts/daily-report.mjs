#!/usr/bin/env node
// daily-report.mjs — Output daily summary as formatted text

import {
  resolveWorkspace, getBackend, openDB, todayStr,
  getDailyStats, getHistoricalStats, getDailyStatsJSON,
} from "./db.mjs";

const ws = resolveWorkspace(process.argv[2]);

async function main() {
  const backend = getBackend(ws);

  if (backend === "sqlite") {
    const db = await openDB(ws);
    if (!db) {
      console.error("Cannot open database");
      process.exit(1);
    }

    const today = todayStr();
    const stats = getDailyStats(db, today);
    const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

    let report = `📊 Daily Report — ${today}\n`;
    report += `─────────────────────────\n`;
    report += `✅ Done: ${stats.done}/${stats.total} (${pct}%)\n`;
    report += `⏳ Pending: ${stats.pending}\n\n`;

    for (const t of stats.tasks) {
      const icon = t.done ? "✅" : "⬜";
      report += `${icon} ${t.emoji} ${t.text}\n`;
    }

    // Weekly trend (last 7 days)
    const history = getHistoricalStats(db).slice(0, 7);
    if (history.length > 1) {
      report += `\n📈 Last ${history.length} days:\n`;
      for (const day of history) {
        const dayPct = day.total > 0 ? Math.round((day.done / day.total) * 100) : 0;
        const bar = "█".repeat(Math.round(dayPct / 10)) + "░".repeat(10 - Math.round(dayPct / 10));
        report += `  ${day.date} ${bar} ${dayPct}%\n`;
      }
    }

    db.close();
    console.log(report);
  } else {
    const stats = getDailyStatsJSON(ws);
    const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

    let report = `📊 Daily Report — ${stats.date}\n`;
    report += `─────────────────────────\n`;
    report += `✅ Done: ${stats.done}/${stats.total} (${pct}%)\n`;
    report += `⏳ Pending: ${stats.pending}\n\n`;

    for (const t of stats.tasks) {
      const icon = t.done ? "✅" : "⬜";
      report += `${icon} ${t.emoji} ${t.text}\n`;
    }

    report += `\n(Historical stats not available in JSON mode)`;
    console.log(report);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
