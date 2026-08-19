import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = join(__dirname, 'data', 'db.json');

export function readDB() {
  const raw = readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(raw);
}

export function writeDB(data) {
  writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}
