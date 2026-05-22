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

# Run a test
npx tsx src/index.ts "Search for elbise and verify results appear"
```

## Design Principles

- **User-facing locators only** — `getByRole`, `getByText`, `getByLabel`, `getByPlaceholder`
- **No waitForTimeout** — web-first assertions only
- **Accessibility tree context** — agents see a11y tree, not raw DOM
- **Strict TypeScript** — no `any`, Playwright native types
- **Healing registry** — JSON history of all locator fixes

## Project Structure

```
src/
├── agents/         # Planner, Generator, Runner, Healer
├── graph/          # LangGraph state & workflow
├── utils/          # Gemini client, a11y extractor, error classifier
└── types/          # Shared TypeScript interfaces

features/           # Generated Gherkin features & step definitions
tests/generated/    # Generated Playwright test files
criteria/           # Generated acceptance criteria (markdown)
```

## Tech Stack

- Playwright + TypeScript
- LangGraph.js (agent orchestration)
- Gemini 2.0 Flash (Google AI SDK)
- Cucumber/Gherkin (BDD step definitions)
