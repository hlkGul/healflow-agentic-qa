import type { HealingRecord } from '../types/index.js';

/**
 * Persistence abstraction for healing history.
 * Allows swapping JSON file, DB, or in-memory implementations.
 */
export interface HealingStore {
  load(): HealingRecord[];
  save(record: HealingRecord): void;
  getByElement(element: string): HealingRecord[];
  formatContext(element: string): string;
}
