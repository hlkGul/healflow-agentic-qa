# Opus-Based Agentic QA

Self-healing test automation with Playwright, LangGraph, and Gemini Flash.

## How It Works

```
"Modanisa'da elbise ara" → Planner → Generator → Runner ↔ Healer → ✅ Step Definitions
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
```

## Usage

### Mode 1: Natural Language Intent

Doğal dille test senaryosu ver, tüm pipeline çalışır:

```bash
npx tsx src/index.ts "Search for elbise and verify results appear"
npx tsx src/index.ts "Modanisa'da elbise ara ve sonuçları doğrula"
npx tsx src/index.ts "Add a product to cart" "https://www.modanisa.com"
```

### Mode 2: From Criteria File

Jira task'ından veya manuel yazılmış bir criteria dosyasını işaret et. Planner atlanır, direkt Generator'a gider:

```bash
npx tsx src/index.ts --file criteria/search-elbise.md
npx tsx src/index.ts --file criteria/my-jira-task.md
```

**Criteria dosyası formatı:**

```markdown
# Test Title

> Target: https://www.modanisa.com

## Preconditions
- User is on the homepage

## Steps
1. **navigate** → homepage (value: "https://www.modanisa.com")
2. **type** → search input (value: "elbise")
3. **press_key** → search input (value: "Enter")
4. **wait_for** → results page (value: "/elbise")

## Expected Results
- ✅ Search results are displayed
```

### Healer Demo

Bozuk locator ile self-healing davranışını test et:

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
