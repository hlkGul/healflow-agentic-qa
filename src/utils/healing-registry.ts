import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { HealingRecord } from '../types/index.js';
import type { HealingStore } from '../healing/healing-store.js';

const HISTORY_PATH = resolve(process.cwd(), 'healing-history.json');

/**
 * JSON file-based healing store implementation.
 */
export class JsonHealingStore implements HealingStore {
  private path: string;

  constructor(path?: string) {
    this.path = path ?? HISTORY_PATH;
  }

  load(): HealingRecord[] {
    if (!existsSync(this.path)) return [];
    const raw = readFileSync(this.path, 'utf-8');
    return JSON.parse(raw) as HealingRecord[];
  }

  save(record: HealingRecord): void {
    const history = this.load();
    history.push(record);
    writeFileSync(this.path, JSON.stringify(history, null, 2), 'utf-8');
  }

  getByElement(element: string): HealingRecord[] {
    return this.load().filter((r) => r.element === element);
  }

  formatContext(element: string): string {
    const records = this.getByElement(element);
    if (records.length === 0) {
      return 'No previous healing history for this element.';
    }
    const lines = records.map((r) => {
      const status = r.success ? '✅' : '❌';
      return `${status} [${r.timestamp}] "${r.originalLocator.strategy}('${r.originalLocator.value}')" → "${r.healedLocator.strategy}('${r.healedLocator.value}')" (${r.reason})`;
    });
    return `Previous healing attempts for "${element}":\n${lines.join('\n')}`;
  }
}

// Default singleton for backward compatibility
const defaultStore = new JsonHealingStore();

export function loadHealingHistory(): HealingRecord[] {
  return defaultStore.load();
}

export function saveHealingRecord(record: HealingRecord): void {
  defaultStore.save(record);
}

export function getHistoryForElement(element: string): HealingRecord[] {
  return defaultStore.getByElement(element);
}

export function formatHistoryContext(element: string): string {
  return defaultStore.formatContext(element);
}
