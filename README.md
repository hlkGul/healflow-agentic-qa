# HealFlow Agentic QA

Self-healing test automation framework with multi-provider LLM support, Playwright, and LangGraph orchestration.

Target site: [modanisa.com](https://www.modanisa.com) — multi-locale e-commerce platform.

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
│ CI PIPELINE (GitHub Actions)                                │
│                                                             │
│  Type Check → Cucumber Tests → Pass? ✅ Done                │
│                               → Fail?                      │
│                                 → Error Classification      │
│                                 → Strategy Chain Healing    │
│                                   (Rule-based → LLM)       │
│                                 → Re-run → ✅              │
│                                 → Create PR with fix       │
└─────────────────────────────────────────────────────────────┘
```

### Agents

| Agent | Role | Input | Output |
|-------|------|-------|--------|
| **Planner** | Converts natural language intent to acceptance criteria | User sentence | Markdown criteria file |
| **Generator** | Produces Playwright test code with user-facing locators | Criteria + a11y tree | Feature + step definitions |
| **Runner** | Executes tests, classifies errors | Step definitions | Pass/fail + error type |
| **Healer** | Fixes broken locators using ariaSnapshot context | Error + a11y snapshot | Updated locator code |

## Quick Start

```bash
# Install dependencies
npm install

# Configure LLM provider (pick one)
cp .env.example .env
# Edit .env — set GEMINI_API_KEY or OPENAI_API_KEY

# Install Playwright browsers
npx playwright install chromium

# Run existing tests (headed locally)
npm test

# Run with self-healing (CI mode)
npm run test:ci
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | One of these | Google Gemini API key |
| `OPENAI_API_KEY` | One of these | OpenAI API key |
| `LLM_PROVIDER` | No | Force provider: `gemini` or `openai` (auto-detected if not set) |
| `TEST_ENV` | No | Target environment: `dev` or `prod` (default: `prod`) |

**Environments:**

| Environment | Base URL | Domain |
|-------------|----------|--------|
| `prod` | https://www.modanisa.com | .modanisa.com |
| `dev` | https://web-dev.modanisa.net | .modanisa.net |

```bash
# Run tests against dev environment
TEST_ENV=dev npm test

# Run tests against prod (default)
npm test
```

Auto-detection priority: `LLM_PROVIDER` env → `GEMINI_API_KEY` present → `OPENAI_API_KEY` present.

## Usage

### Run Tests (Cucumber + BDD)

```bash
npm test                         # All feature tests (headed in local)
npm run test:ci                  # Self-healing CI mode (headless)
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

### Multi-Locale Testing

Tests use parametric locale selection:

```gherkin
Given I open the site in "USA" country with "en" language
```

Supported countries: USA, Turkey, Germany, France, UK, UAE  
Supported languages: en, tr, de, ar

> **Note:** Current test scenarios run in EN locale only. TR locale has structural DOM differences (e.g., no primary price element for price comparison) that make cross-locale assertions unreliable. Multi-locale support is available in the framework but not actively used in CI until locale-specific assertion logic is implemented.

## Design Principles

- **User-facing locators only** — `getByRole`, `getByText`, `getByLabel`, `getByPlaceholder`, `getByTestId`
- **No waitForTimeout** — web-first assertions and auto-waiting only
- **AriaSnapshot context** — agents receive `page.locator('body').ariaSnapshot()`, not raw DOM
- **Strict TypeScript** — no `any`, Playwright native types (`Page`, `Locator`, `BrowserContext`)
- **Multi-provider LLM** — swap between Gemini and OpenAI via env variable
- **Retry with backoff** — LLM calls retry on 429/503/500 with exponential backoff
- **Healing registry** — JSON history of all locator fixes for learning context
- **Intent-based model** — no Page Object Model; tests express user intent directly

## Project Structure

```
src/
├── agents/              # Planner, Generator, Runner, Healer
├── graph/               # LangGraph state machine & workflow
├── healing/             # Self-healing abstractions & strategies
│   ├── types.ts         # HealingStrategy, HealingContext, HealingSuggestion interfaces
│   ├── index.ts         # HealerEngine (strategy chain) + barrel exports
│   ├── rule-based-strategy.ts  # Pattern-based healing (no LLM cost)
│   ├── llm-strategy.ts         # LLM-based healing (fallback)
│   ├── context-provider.ts     # ContextProvider interface
│   ├── browser-context-provider.ts  # AriaSnapshot capture implementation
│   ├── healing-store.ts        # HealingStore interface
│   ├── test-runner.ts          # TestRunner interface
│   └── cucumber-runner.ts      # CucumberRunner implementation
├── utils/
│   ├── llm/             # Multi-provider abstraction (Gemini, OpenAI)
│   ├── llm-client.ts    # Unified callLLM / callLLMWithJson with retry
│   ├── accessibility.ts # ariaSnapshot capture (primary) + deprecated API fallback
│   ├── heal-logic.ts    # Healing orchestrator (uses ContextProvider + HealerEngine)
│   ├── healing-registry.ts  # JsonHealingStore + backward-compatible exports
│   ├── error-classifier.ts  # ErrorClassifier interface + PatternErrorClassifier
│   └── step-generator.ts    # Step definition code generation
├── support/
│   ├── world.ts         # Cucumber hooks (Before/After, popup auto-dismiss)
│   ├── locale.ts        # Country/language cookie-based locale setter
│   └── environment.ts   # Dev/prod environment config (base URL, domain)
├── step-definitions/    # Cucumber step definitions
├── types/               # Shared TypeScript interfaces
├── ci-runner.ts         # CI self-healing orchestrator
└── index.ts             # CLI entry point (intent & file modes)

features/                # Gherkin feature files
├── search.feature       # Search product test
├── add-to-cart.feature  # Add to cart + verify test
└── price-verification.feature  # Price match between listing & detail

criteria/                # Acceptance criteria (markdown)
healing-history.json     # Healing registry (auto-updated)
.github/workflows/ci.yml # GitHub Actions pipeline
```

## Self-Healing Flow

1. **Error Classification** — Categorizes failure as `locator` / `timeout` / `network` / `unknown`
2. **Context Capture** — Navigates to the failing page via `BrowserContextProvider`, captures `ariaSnapshot()`
3. **Strategy Chain** — Tries `RuleBasedStrategy` first (free, fast pattern-matching), falls back to `LLMStrategy`
4. **Apply Fix** — Replaces broken locator in step definition code
5. **Re-run** — Executes test again (max 3 retries); navigation timeouts get up to 2 extra attempts
6. **Registry** — Records the healing attempt in `healing-history.json` for future context
7. **PR Creation** — If healer fixes locators in CI, a new branch + PR is created automatically

### Strategy Chain

```
Error detected → RuleBasedStrategy (pattern match ariaSnapshot)
                      │
                      ├─ Match found (high confidence) → Apply fix
                      │
                      └─ No match → LLMStrategy (Gemini/OpenAI)
                                         │
                                         └─ Suggestion → Apply fix
```

The rule-based strategy handles common cases (textbox placeholders, button labels) without LLM cost. The LLM strategy handles complex or unknown patterns.

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

- ✅ **AriaSnapshot** — We use `page.locator('body').ariaSnapshot()` (stable Playwright API) to capture structured accessibility context for our healer — the same snapshot approach MCP tools use internally.

**Future roadmap:**  
When `@playwright/mcp` reaches stable (1.x), we may integrate it as an alternative context provider for the healer, or use it to enable IDE-driven test generation alongside our autonomous CI flow.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Browser automation | Playwright 1.60+ (TypeScript) |
| Agent orchestration | LangGraph.js |
| LLM providers | Gemini Flash / OpenAI (pluggable) |
| BDD framework | Cucumber.js + Gherkin |
| CI/CD | GitHub Actions |
| Locale management | Cookie-based (no IP dependency) |

## CI Pipeline

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push/PR to `main`:

1. **Type Check** — `tsc --noEmit`
2. **E2E Tests** — Cucumber tests with self-healing via `src/ci-runner.ts`
3. **Auto-heal PR** — If healer fixes locators, a new branch is created and a PR is opened automatically

The PR includes:
- Updated step definition files with healed locators
- Updated `healing-history.json` with healing records
- Descriptive commit message with healing details

Required secrets: `GEMINI_API_KEY` (or `OPENAI_API_KEY`)

> **Note:** Repository must have "Allow GitHub Actions to create and approve pull requests" enabled in Settings → Actions → General.

## Extensibility (Interfaces)

The `src/healing/` module provides clean interfaces for extending the system:

| Interface | Purpose | Implementations |
|-----------|---------|-----------------|
| `HealingStrategy` | Strategy for fixing broken locators | `RuleBasedStrategy`, `LLMStrategy` |
| `ContextProvider` | Captures page context (a11y tree) | `BrowserContextProvider` |
| `HealingStore` | Persists healing history | `JsonHealingStore` |
| `TestRunner` | Executes tests and returns results | `CucumberRunner` |
| `ErrorClassifier` | Categorizes test failures | `PatternErrorClassifier` |

To add a new healing strategy (e.g., visual-based):

```typescript
import { HealingStrategy, HealingContext, HealingSuggestion } from './src/healing';

class VisualStrategy implements HealingStrategy {
  name = 'visual';
  async heal(context: HealingContext): Promise<HealingSuggestion | null> {
    // Your implementation
  }
}
```

Then register it in the `HealerEngine` strategy chain.
