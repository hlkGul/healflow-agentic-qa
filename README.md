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

## Why Not Playwright's Built-in Test Agents?

Playwright v1.60+ introduces [Test Agents](https://playwright.dev/docs/test-agents) — MCP-based tool definitions for IDE-driven AI workflows (VS Code Copilot, Claude Code, etc.).

**Why we don't use them:**

| Aspect | Playwright Test Agents | Our Approach |
|--------|----------------------|--------------|
| Execution model | Interactive (IDE-driven) | Autonomous (CLI/CI) |
| Orchestration | External AI tool decides | LangGraph state machine |
| Healing | Manual via IDE prompts | Automatic retry loop |
| CI/CD | Not designed for headless CI | Built for CI pipelines |
| Maturity | `@playwright/mcp` is alpha (0.0.x) | Production-ready with stable APIs |

**What we adopted from MCP:**

- ✅ **AriaSnapshot** — We use `page.locator('body').ariaSnapshot()` (stable Playwright API) to capture structured accessibility context for our healer, which is the same snapshot approach MCP tools use internally.

**Future roadmap:**
When `@playwright/mcp` reaches stable (1.x), we may integrate it as an alternative context provider for the healer agent, or use it to enable IDE-driven test generation alongside our autonomous CI flow.

## Tech Stack

- Playwright + TypeScript
- LangGraph.js (agent orchestration)
- Multi-provider LLM (Gemini Flash / OpenAI — auto-detected from env)
- Cucumber/Gherkin (BDD step definitions)
