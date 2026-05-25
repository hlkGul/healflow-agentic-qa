import type { Page } from '@playwright/test';
import type { AccessibilitySnapshot, AccessibilityNode } from '../types/index.js';

/**
 * Captures page accessibility context using Playwright's ariaSnapshot (stable API).
 * Falls back to deprecated page.accessibility.snapshot() if ariaSnapshot fails.
 */
export async function getAccessibilitySnapshot(page: Page): Promise<AccessibilitySnapshot> {
  // Primary: Playwright ariaSnapshot (stable, structured YAML-like output)
  try {
    const ariaRaw = await page.locator('body').ariaSnapshot({ timeout: 10000 });
    return {
      tree: null,
      raw: ariaRaw,
      method: 'aria-snapshot',
    };
  } catch {
    // Fallback below
  }

  // Fallback: deprecated accessibility API (still functional in Playwright 1.x)
  try {
    // @ts-expect-error: accessibility API is deprecated but functional
    const snapshot = await page.accessibility.snapshot();

    if (snapshot) {
      const tree = normalizeNode(snapshot);
      return {
        tree,
        raw: formatTreeAsText(tree),
        method: 'snapshot',
      };
    }
  } catch {
    // Final fallback
  }

  return {
    tree: null,
    raw: 'Unable to capture accessibility tree',
    method: 'snapshot',
  };
}

function normalizeNode(node: Record<string, unknown>): AccessibilityNode {
  return {
    role: (node['role'] as string) ?? 'unknown',
    name: (node['name'] as string) ?? '',
    value: node['value'] as string | undefined,
    description: node['description'] as string | undefined,
    children: Array.isArray(node['children'])
      ? (node['children'] as Record<string, unknown>[]).map(normalizeNode)
      : undefined,
  };
}

function formatTreeAsText(node: AccessibilityNode | null, indent: number = 0): string {
  if (!node) return '';

  const prefix = '  '.repeat(indent);
  let line = `${prefix}[${node.role}] "${node.name}"`;

  if (node.value) {
    line += ` value="${node.value}"`;
  }

  const lines = [line];

  if (node.children) {
    for (const child of node.children) {
      lines.push(formatTreeAsText(child, indent + 1));
    }
  }

  return lines.join('\n');
}

export function truncateTree(raw: string, maxLength: number = 4000): string {
  if (raw.length <= maxLength) return raw;
  return raw.slice(0, maxLength) + '\n... [truncated]';
}
