import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { HealingRecord } from '../types/index.js';

const HISTORY_PATH = resolve(process.cwd(), 'healing-history.json');

export function loadHealingHistory(): HealingRecord[] {
  if (!existsSync(HISTORY_PATH)) {
    return [];
  }

  const raw = readFileSync(HISTORY_PATH, 'utf-8');
  return JSON.parse(raw) as HealingRecord[];
}

export function saveHealingRecord(record: HealingRecord): void {
  const history = loadHealingHistory();
  history.push(record);
  writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2), 'utf-8');
}

export function getHistoryForElement(element: string): HealingRecord[] {
  const history = loadHealingHistory();
  return history.filter((r) => r.element === element);
}

export function formatHistoryContext(element: string): string {
  const records = getHistoryForElement(element);

  if (records.length === 0) {
    return 'No previous healing history for this element.';
  }

  const lines = records.map((r) => {
    const status = r.success ? '✅' : '❌';
    return `${status} [${r.timestamp}] "${r.originalLocator.strategy}('${r.originalLocator.value}')" → "${r.healedLocator.strategy}('${r.healedLocator.value}')" (${r.reason})`;
  });

  return `Previous healing attempts for "${element}":\n${lines.join('\n')}`;
}
