import { readFileSync } from 'node:fs';
import type { AcceptanceCriteria, TestStep } from '../types/index.js';

/**
 * Parses a criteria markdown file into AcceptanceCriteria struct.
 * Expected format:
 *
 * # Title
 * > Target: https://...
 *
 * ## Preconditions
 * - precondition 1
 *
 * ## Steps
 * 1. **action** → target (value: "val")
 *
 * ## Expected Results
 * - ✅ result 1
 */
export function parseCriteriaFile(filePath: string): { criteria: AcceptanceCriteria; targetUrl: string } {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  let title = '';
  let targetUrl = 'https://www.modanisa.com';
  const preconditions: string[] = [];
  const steps: TestStep[] = [];
  const expectedResults: string[] = [];

  let section: 'none' | 'preconditions' | 'steps' | 'expected' = 'none';

  for (const line of lines) {
    const trimmed = line.trim();

    // Title
    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
      title = trimmed.replace(/^# /, '');
      continue;
    }

    // Target URL from blockquote
    const targetMatch = />\s*Target:\s*(.+)/.exec(trimmed);
    if (targetMatch) {
      targetUrl = targetMatch[1]!.trim();
      continue;
    }

    // Section headers
    if (trimmed.startsWith('## Preconditions')) { section = 'preconditions'; continue; }
    if (trimmed.startsWith('## Steps')) { section = 'steps'; continue; }
    if (trimmed.startsWith('## Expected')) { section = 'expected'; continue; }

    // Parse content based on section
    if (section === 'preconditions' && trimmed.startsWith('- ')) {
      preconditions.push(trimmed.replace(/^- /, ''));
    }

    if (section === 'steps') {
      const stepMatch = /^(\d+)\.\s*\*\*(\w+)\*\*\s*→\s*(.+?)(?:\s*\(value:\s*"([^"]*)"\))?$/.exec(trimmed);
      if (stepMatch) {
        steps.push({
          order: parseInt(stepMatch[1]!, 10),
          action: stepMatch[2]!,
          target: stepMatch[3]!.trim(),
          value: stepMatch[4],
        });
      }
    }

    if (section === 'expected' && trimmed.startsWith('- ')) {
      expectedResults.push(trimmed.replace(/^-\s*✅?\s*/, ''));
    }
  }

  return {
    criteria: { title, preconditions, steps, expectedResults },
    targetUrl,
  };
}
