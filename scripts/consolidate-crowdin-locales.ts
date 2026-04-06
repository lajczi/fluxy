import fs from 'fs';
import path from 'path';

const ROOT = path.join(process.cwd());
const OUT = path.join(ROOT, 'src', 'locales');

const SKIP = new Set(['node_modules', 'src', 'dashboard', 'tests', 'build', 'coverage', 'logs', '.git', 'en']);

function pickSourceFile(folder: string, files: string[]): string | null {
  const base = `${folder}.json`;
  if (files.includes(base)) return base;
  const sorted = [...files].sort((a, b) => a.localeCompare(b));
  const short = sorted.find((f) => /^[a-z]{2}\.json$/i.test(f));
  if (short) return short;
  return sorted[0] ?? null;
}

function main() {
  const entries = fs.readdirSync(ROOT, { withFileTypes: true });
  let copied = 0;

  for (const ent of entries) {
    if (!ent.isDirectory() || SKIP.has(ent.name)) continue;
    const folder = ent.name;
    const locPath = path.join(ROOT, folder, 'src', 'locales');
    if (!fs.existsSync(locPath)) continue;

    const files = fs.readdirSync(locPath).filter((f) => f.endsWith('.json'));
    if (files.length === 0) continue;

    const pick = pickSourceFile(folder, files);
    if (!pick) continue;

    const src = path.join(locPath, pick);
    const destName = pick;
    const dest = path.join(OUT, destName);

    fs.mkdirSync(OUT, { recursive: true });
    fs.copyFileSync(src, dest);
    console.log(`${folder}/${pick} -> src/locales/${destName}`);
    copied++;
  }

  console.log(`Done. Copied ${copied} file(s) into src/locales/.`);
}

main();
