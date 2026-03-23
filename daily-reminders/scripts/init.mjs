#!/usr/bin/env node
// init.mjs — Interactive setup for daily-reminders

import { createInterface } from "node:readline";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { resolveWorkspace, saveConfig, loadConfig, configPath } from "./db.mjs";

const ws = resolveWorkspace(process.argv[2]);
const rl = createInterface({ input: process.stdin, output: process.stdout });

function ask(q, def) {
  return new Promise((res) => {
    const prompt = def !== undefined ? `${q} [${def}]: ` : `${q}: `;
    rl.question(prompt, (ans) => res(ans.trim() || (def !== undefined ? String(def) : "")));
  });
}

async function detectSQLite() {
  // Try node:sqlite (Node ≥22.5)
  try {
    await import("node:sqlite");
    console.log("✔ Found node:sqlite (built-in)");
    return "node:sqlite";
  } catch {}

  // Try better-sqlite3
  try {
    await import("better-sqlite3");
    console.log("✔ Found better-sqlite3");
    return "better-sqlite3";
  } catch {}

  return null;
}

async function main() {
  console.log("\n🔧 Daily Reminders — Setup\n");

  // Step 1: Detect SQLite
  let backend = "json";
  const sqliteSource = await detectSQLite();

  if (sqliteSource) {
    backend = "sqlite";
  } else {
    console.log("⚠ No SQLite library found.");
    const install = await ask("Install better-sqlite3? (y/n)", "n");
    if (install.toLowerCase() === "y") {
      try {
        console.log("Installing better-sqlite3...");
        execSync("npm install better-sqlite3", { cwd: ws, stdio: "inherit" });
        backend = "sqlite";
        console.log("✔ Installed better-sqlite3");
      } catch {
        console.log("✘ Installation failed. Falling back to JSON.");
      }
    } else {
      console.log("→ Using JSON backend (limited features: no snooze, no subtasks, no historical stats)");
    }
  }

  // Step 2: Reminder frequency
  console.log("\nReminder frequency options: 15, 30, 60, or custom minutes");
  const freq = parseInt(await ask("Frequency in minutes", "30"), 10) || 30;

  // Step 3: Time window
  const winStart = parseInt(await ask("Window start hour (0-23)", "8"), 10);
  const winEnd = parseInt(await ask("Window end hour (0-23)", "20"), 10);

  // Step 4: Snooze options
  const snoozeRaw = await ask("Snooze options (comma-separated)", "30m,1h,2h,4h");
  const snoozeOptions = snoozeRaw.split(",").map((s) => s.trim()).filter(Boolean);

  // Save config
  const cfg = {
    backend,
    frequencyMinutes: freq,
    windowStart: winStart,
    windowEnd: winEnd,
    snoozeOptions,
  };
  saveConfig(ws, cfg);
  console.log(`\n✔ Config saved to ${configPath(ws)}`);

  // Step 5: Migrate existing data
  const oldFile = join(ws, "memory", "recordatorios-hoy.json");
  if (existsSync(oldFile) && backend === "sqlite") {
    const migrate = await ask("\nFound existing recordatorios-hoy.json. Migrate to SQLite? (y/n)", "y");
    if (migrate.toLowerCase() === "y") {
      try {
        const { execFileSync } = await import("node:child_process");
        execFileSync("node", [join(ws, "skills/daily-reminders/scripts/migrate.mjs"), ws], {
          stdio: "inherit",
        });
      } catch (e) {
        console.log("✘ Migration failed:", e.message);
      }
    }
  }

  // Summary
  console.log("\n" + "─".repeat(40));
  console.log("📋 Configuration Summary");
  console.log("─".repeat(40));
  console.log(`  Backend:    ${cfg.backend}`);
  console.log(`  Frequency:  every ${cfg.frequencyMinutes} minutes`);
  console.log(`  Window:     ${cfg.windowStart}:00 — ${cfg.windowEnd}:00`);
  console.log(`  Snooze:     ${cfg.snoozeOptions.join(", ")}`);
  console.log("─".repeat(40));
  console.log("\nDone! Update your cron jobs to match the new config.\n");

  rl.close();
}

main().catch((e) => {
  console.error(e);
  rl.close();
  process.exit(1);
});
