/**
 * One-off analytics cleanup for data recorded before the 2026-09 analytics fixes.
 * Dry run by default:  npx tsx scripts/cleanup-analytics.ts
 * Apply:              npx tsx scripts/cleanup-analytics.ts --apply --backup=backups/<file>.json
 *   A. Council Bluffs (Replit proxy location)  -> country Unknown, city removed (clicks kept)
 *   B. Fake locations from old local-dev code  -> clicks removed ("United States"/new york, "United Kingdom"/london)
 *   C. Own site as referrer                    -> "direct"
 *   D. Malformed country codes ("undefined")   -> Unknown
 */
import "dotenv/config";
import fs from "node:fs";
import { pool } from "../server/db";

const APPLY = process.argv.includes("--apply");
const BACKUP_FILE = process.argv.find((a) => a.startsWith("--backup="))?.slice("--backup=".length);
const OWN_HOST = /(^|\.)replit\.dev$|^adlink\.dcxtransform\.com$|^localhost$/;
const FAKE = [
  { code: "US", name: "United States", city: "new york" },
  { code: "GB", name: "United Kingdom", city: "london" },
];

type Country = { count: number; name: string; cities?: Record<string, number> };

function addUnknown(countries: Record<string, Country>, n: number) {
  countries.UNKNOWN ??= { count: 0, name: "Unknown", cities: {} };
  countries.UNKNOWN.count += n;
}

function take(map: Record<string, number>, key: string, n: number): number {
  const taken = Math.min(map[key] ?? 0, n);
  if (taken) {
    map[key] -= taken;
    if (map[key] === 0) delete map[key];
  }
  return taken;
}

const client = await pool.connect();
try {
  await client.query("BEGIN");
  const rows = (await client.query(`select id, short_code, clicks, analytics from urls order by id for update`)).rows;
  const backup: unknown[] = [];
  const updates: { id: number; clicks: number; analytics: unknown }[] = [];
  const summary = { relabelledLocation: 0, removedFake: 0, relabelledReferrer: 0, fixedCodes: 0, warnings: [] as string[] };

  for (const row of rows) {
    const before = JSON.stringify(row.analytics);
    const a = JSON.parse(before);
    const countries: Record<string, Country> = a.countries ?? {};
    let clicks: number = row.clicks;
    const notes: string[] = [];

    // D. malformed country codes
    for (const code of Object.keys(countries)) {
      if (code !== "UNKNOWN" && !/^[A-Z]{2}$/.test(code)) {
        addUnknown(countries, countries[code].count ?? 0);
        summary.fixedCodes += countries[code].count ?? 0;
        notes.push(`country "${code}" x${countries[code].count} -> Unknown`);
        delete countries[code];
      }
    }

    // A. Council Bluffs = Replit's proxy, not the visitor
    const cb = countries.US?.cities?.["council bluffs"] ?? 0;
    if (cb) {
      delete countries.US.cities!["council bluffs"];
      countries.US.count -= cb;
      if (countries.US.count <= 0) delete countries.US;
      addUnknown(countries, cb);
      summary.relabelledLocation += cb;
      notes.push(`Council Bluffs x${cb} -> Unknown`);
    }

    // B. fabricated locations from local development: remove those clicks everywhere
    for (const fake of FAKE) {
      const entry = countries[fake.code];
      const n = entry?.name === fake.name ? entry.cities?.[fake.city] ?? 0 : 0;
      if (!n) continue;
      delete entry.cities![fake.city];
      entry.count -= n;
      if (entry.count <= 0) delete countries[fake.code];
      clicks -= n;
      // Local test visits were desktop/Windows; referrer was localhost or none
      const fromDesktop = take(a.devices ?? {}, "desktop", n);
      const fromOs = take(a.deviceDetails?.os ?? {}, "Windows 10", n);
      let fromRef = take(a.referrers ?? {}, "localhost", n);
      fromRef += take(a.referrers ?? {}, "direct", n - fromRef);
      if (fromDesktop < n || fromRef < n) summary.warnings.push(`${row.short_code}: could only remove ${fromDesktop}/${n} device, ${fromRef}/${n} referrer entries`);
      if (a.deviceDetails?.os && fromOs < n) notes.push(`(OS: removed ${fromOs}/${n})`);
      summary.removedFake += n;
      notes.push(`fake ${fake.city} x${n} removed`);
    }

    // C. own site as referrer
    for (const [host, n] of Object.entries(a.referrers ?? {}) as [string, number][]) {
      if (OWN_HOST.test(host)) {
        delete a.referrers[host];
        a.referrers.direct = (a.referrers.direct ?? 0) + n;
        summary.relabelledReferrer += n;
        notes.push(`referrer ${host.length > 30 ? host.slice(0, 12) + "…replit.dev" : host} x${n} -> direct`);
      }
    }

    a.countries = countries;
    if (JSON.stringify(a) !== before || clicks !== row.clicks) {
      backup.push({ id: row.id, short_code: row.short_code, clicks: row.clicks, analytics: row.analytics });
      updates.push({ id: row.id, clicks, analytics: a });
      console.log(`${row.short_code.padEnd(10)} clicks ${row.clicks}${clicks !== row.clicks ? ` -> ${clicks}` : ""}: ${notes.join("; ")}`);
    }
  }

  // Consistency check: every total must equal the click count
  const sum = (o: Record<string, any> = {}) => Object.values(o).reduce((s: number, v: any) => s + (typeof v === "number" ? v : v.count ?? 0), 0);
  for (const u of updates) {
    const a: any = u.analytics;
    const totals = [sum(a.devices), sum(a.countries), sum(a.referrers)];
    if (totals.some((t) => t !== u.clicks)) summary.warnings.push(`id ${u.id}: totals ${totals.join("/")} != clicks ${u.clicks}`);
  }

  console.log(`\n${updates.length} links affected:`, { ...summary, warnings: summary.warnings.length });
  summary.warnings.forEach((w) => console.log("WARNING:", w));

  if (!APPLY) {
    await client.query("ROLLBACK");
    console.log("\nDry run: nothing written. Re-run with --apply to make these changes.");
  } else {
    if (!BACKUP_FILE) throw new Error("--backup=<file> is required with --apply");
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(backup, null, 2));
    for (const u of updates) {
      await client.query(`update urls set clicks = $1, analytics = $2 where id = $3`, [u.clicks, JSON.stringify(u.analytics), u.id]);
    }
    await client.query("COMMIT");
    console.log(`\nApplied. Original values of ${backup.length} links saved to ${BACKUP_FILE}`);
  }
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  client.release();
  await pool.end();
}
