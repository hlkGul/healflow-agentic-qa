import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { callGeminiWithJson } from '../utils/gemini-client.js';
import type { AcceptanceCriteria, TestIntent } from '../types/index.js';
import type { GraphStateType } from '../graph/state.js';

const PLANNER_SYSTEM_PROMPT = `You are a QA Test Planner agent. Your job is to convert a user's natural language test intent into structured acceptance criteria.

RULES:
- Output must be valid JSON matching the AcceptanceCriteria schema
- Steps should be atomic user actions (click, type, navigate, verify)
- Use plain language for targets (e.g., "search input", "search button") — NOT selectors
- Expected results should be observable outcomes a user would see
- Keep steps minimal and focused on the stated intent
- Preconditions should include the starting URL/state
- For search actions: type the text, then press Enter (not click a button)
- After any action that navigates to a new page, add a "wait_for" step for the new URL/page

OUTPUT SCHEMA:
{
  "title": "string - descriptive test title",
  "preconditions": ["string - what must be true before test starts"],
  "steps": [
    {
      "order": 1,
      "action": "navigate|click|type|press_key|verify|wait_for",
      "target": "human-readable element description",
      "value": "optional - text to type, key to press, or expected value"
    }
  ],
  "expectedResults": ["string - what should be true after all steps"]
}`;

export async function plannerAgent(state: GraphStateType): Promise<Partial<GraphStateType>> {
  const { intent } = state;

  const userPrompt = buildUserPrompt(intent);
  const criteria = await callGeminiWithJson<AcceptanceCriteria>(
    PLANNER_SYSTEM_PROMPT,
    userPrompt,
    { maxTokens: 2048, temperature: 0.1 }
  );

  // Write criteria to markdown file
  const mdContent = formatCriteriaAsMarkdown(criteria, intent);
  const filePath = resolve(process.cwd(), 'criteria', `${slugify(criteria.title)}.md`);
  writeFileSync(filePath, mdContent, 'utf-8');

  return {
    phase: 'generating',
    criteria,
    errorLog: [`[Planner] Generated criteria: "${criteria.title}" with ${criteria.steps.length} steps`],
  };
}

function buildUserPrompt(intent: TestIntent): string {
  return `Convert this test intent into acceptance criteria:

USER INTENT: "${intent.userMessage}"
TARGET WEBSITE: ${intent.targetUrl}

Generate the acceptance criteria JSON.`;
}

function formatCriteriaAsMarkdown(criteria: AcceptanceCriteria, intent: TestIntent): string {
  const lines = [
    `# ${criteria.title}`,
    '',
    `> Original intent: "${intent.userMessage}"`,
    `> Target: ${intent.targetUrl}`,
    '',
    '## Preconditions',
    ...criteria.preconditions.map((p) => `- ${p}`),
    '',
    '## Steps',
    ...criteria.steps.map((s) => `${s.order}. **${s.action}** → ${s.target}${s.value ? ` (value: "${s.value}")` : ''}`),
    '',
    '## Expected Results',
    ...criteria.expectedResults.map((r) => `- ✅ ${r}`),
    '',
  ];
  return lines.join('\n');
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}
