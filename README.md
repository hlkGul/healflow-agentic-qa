# Opus-Based Agentic QA

Self-healing test automation with Playwright, LangGraph, and Gemini Flash.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ LOCAL DEVELOPMENT                                           │
│                                                             │
│  "elbise ara" → Planner → Generator → Runner → Healer      │
│                                          │                  │
│                                          ▼                  │
│                              features/*.feature             │
│                              src/step-definitions/*.ts      │
│                                          │                  │
│                                     git commit              │
└──────────────────────────────────────────┼──────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────┐
│ CI PIPELINE                                                 │
│                                                             │
│  Cucumber (features + step-definitions) → Pass? ✅ Done     │
│                                         → Fail?            │
│                                           → Healer → Fix   │
│                                           → Re-run → ✅    │
│                                           → Auto-commit    │
└─────────────────────────────────────────────────────────────┘
```

1. **Planner Agent** — Converts natural language intent to acceptance criteria
2. **Generator Agent** — Produces Playwright test code (user-facing locators only)
3. **Runner** — Executes the test, classifies errors
4. **Healer Agent** — Fixes broken locators using accessibility tree context

## Quick Start

```bash
# Install dependencies
npm install

# Set your Gemini API key
cp .env.example .env
# Edit .env with your GEMINI_API_KEY

# Install Playwright browsers
npx playwright install chromium

# Run existing tests (Cucumber)
npm test
```

## Usage

### Run Tests (Cucumber)

```bash
npm test                         # Run all feature tests
npm run test:ci                  # Run with self-healing (CI mode)
```

### Generate New Tests

From natural language:
```bash
npm run generate -- "Search for elbise and verify results"
npm run generate -- "Modanisa'da elbise ara ve sonuçları doğrula"
```

From criteria file (skip planner):
```bash
npm run generate -- --file criteria/search-elbise.md
```

### Healer Demo

```bash
npx tsx src/test-healer.ts
```

## Design Principles

- **User-facing locators only** — `getByRole`, `getByText`, `getByLabel`, `getByPlaceholder`
- **No waitForTimeout** — web-first assertions only
- **Accessibility tree context** — agents see a11y tree, not raw DOM
- **Strict TypeScript** — no `any`, Playwright native types
- **Healing registry** — JSON history of all locator fixes
- **Auto-cleanup** — old generated files removed on each run

## Project Structure

```
src/
├── agents/            # Planner, Generator, Runner, Healer
├── graph/             # LangGraph state & workflow
├── utils/             # Gemini client, a11y extractor, error classifier
├── step-definitions/  # Generated Cucumber step definitions
├── types/             # Shared TypeScript interfaces
└── index.ts           # CLI entry point (intent & file modes)

features/              # Generated Gherkin feature files
tests/generated/       # Generated Playwright test files
criteria/              # Acceptance criteria (markdown)
healing-history.json   # Healing registry
```

## Tech Stack

- Playwright + TypeScript
- LangGraph.js (agent orchestration)
- Gemini 2.0 Flash (Google AI SDK)
- Cucumber/Gherkin (BDD step definitions)
