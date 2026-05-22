# Agentic QA Workflows - Self-Healing Locators

## Problem Statement
Modanisa.com üzerinde intent-based, self-healing test otomasyonu. Kullanıcı doğal dilde test senaryosu yazar, agent'lar bunu çalıştırılabilir teste dönüştürür. Locator patladığında Healer agent otomatik düzeltir.

## Architecture

```
User Intent (doğal dil)
       │
       ▼
┌─────────────┐    ┌──────────────┐    ┌────────────┐    ┌─────────────┐
│   PLANNER   │───▶│  GENERATOR   │───▶│   RUNNER   │───▶│   HEALER    │
│             │    │              │    │            │    │             │
│ Intent →    │    │ Criteria →   │    │ Kodu       │    │ Locator     │
│ Acceptance  │    │ Playwright   │    │ çalıştırır │    │ düzeltir    │
│ Criteria    │    │ test kodu    │    │            │    │             │
└─────────────┘    └──────────────┘    └────────────┘    └─────────────┘
                                              │                  │
                                              ◀──────────────────┘
                                              (max 3 retry loop)
```

## Tech Stack
- **Test Framework:** Playwright + TypeScript
- **LLM:** Gemini Flash (Google AI SDK direkt)
- **Orchestration:** LangGraph.js (in-memory state)
- **BDD Layer:** Cucumber/Gherkin (başarılı testler step definition olarak kaydedilir)
- **Browser:** Headful (debug mode)
- **Target:** https://www.modanisa.com

## Design Principles

### Locator Stratejisi
- ✅ `getByRole`, `getByText`, `getByLabel`, `getByPlaceholder`
- ❌ XPath, karmaşık CSS selectors

### Bekleme Stratejisi
- ✅ Web-first assertions: `expect(locator).toBeVisible()`
- ❌ `page.waitForTimeout()` kesinlikle yasak

### Performans & Maliyet
- Agent'lara DOM tree değil **accessibility tree** verilir
- Her iki yöntem denenecek: `page.accessibility.snapshot()` ve Playwright AriaSnapshot
- LLM API çağrılarında max-steps limiti tanımlanacak

### Type Safety
- Strict TypeScript (`any` yasak)
- Playwright native tipleri: `Page`, `Locator`, `BrowserContext`

### Error Classification
| Hata Tipi | Aksiyon |
|-----------|---------|
| Element not found / Locator timeout | → Healer'a gönder |
| Navigation timeout / Network error | → Retry (max 2) sonra fail |
| Assertion failed (element var, değer yanlış) | → Test fail (heal etme) |
| Unexpected dialog/popup | → Dismiss et, tekrar dene |

### Healing Registry
- JSON tabanlı history tutulacak (blacklist yok)
- Her healing kaydı: element, original locator, healed locator, reason, timestamp
- Agent geçmiş healing denemelerini context olarak görecek

### Step Definition Üretimi
- Başarılı test → Gherkin step definition olarak kaydedilir
- Aynı intent tekrar geldiğinde mevcut step kullanılabilir (cache)
- Proje zamanla kendi test kütüphanesini oluşturur

---

## Implementation Plan

### Faz 1: Proje Altyapısı
- [ ] Node.js + TypeScript proje kurulumu (tsconfig, package.json)
- [ ] Playwright kurulumu ve konfigürasyonu (headful, base URL)
- [ ] LangGraph.js kurulumu
- [ ] Google AI SDK (Gemini) kurulumu
- [ ] Cucumber.js kurulumu ve Playwright entegrasyonu
- [ ] Proje dizin yapısı oluşturma

### Faz 2: Core State & Types
- [ ] LangGraph state schema tanımlama (AgentState interface)
- [ ] Shared types: TestIntent, AcceptanceCriteria, TestCode, HealingRecord, ExecutionResult
- [ ] Error classification utility
- [ ] Accessibility tree extractor (her iki yöntem)

### Faz 3: Planner Agent
- [ ] Doğal dil intent → structured acceptance criteria dönüşümü
- [ ] Criteria'yı markdown dosyasına yazma
- [ ] Gemini Flash prompt engineering (planner system prompt)

### Faz 4: Generator Agent
- [ ] Acceptance criteria → Playwright test kodu üretimi
- [ ] User-facing locator constraint enforcement
- [ ] Üretilen kodun geçici .ts dosyasına yazılması
- [ ] Gemini Flash prompt engineering (generator system prompt)

### Faz 5: Runner
- [ ] Geçici test dosyasını `npx playwright test` ile çalıştırma
- [ ] Stdout/stderr parsing
- [ ] Error classification ve routing
- [ ] Accessibility tree snapshot alma (hata durumunda)

### Faz 6: Healer Agent
- [ ] Error + a11y tree context ile yeni locator önerisi
- [ ] Healing registry'ye kayıt
- [ ] Test kodundaki locator'ı güncelleme
- [ ] Retry loop (max 3)
- [ ] Gemini Flash prompt engineering (healer system prompt)

### Faz 7: LangGraph Orchestration
- [ ] Graph tanımlama (nodes: planner, generator, runner, healer)
- [ ] Conditional edges (runner → healer veya success)
- [ ] State transitions
- [ ] Max retry guard

### Faz 8: Step Definition Üretimi
- [ ] Başarılı test → Gherkin feature file oluşturma
- [ ] Step definition TypeScript dosyası üretimi
- [ ] Mevcut step'lerin cache/lookup mekanizması

### Faz 9: Search Test Senaryosu (E2E)
- [ ] "Modanisa'da 'elbise' ara ve sonuçları gör" intent'i ile full flow test
- [ ] Healer'ın çalıştığını doğrulama (kasıtlı locator bozma)
- [ ] Step definition'ın üretildiğini doğrulama

---

## Proje Dizin Yapısı

```
opus-oriented/
├── package.json
├── tsconfig.json
├── playwright.config.ts
├── cucumber.js
├── src/
│   ├── agents/
│   │   ├── planner.ts
│   │   ├── generator.ts
│   │   ├── runner.ts
│   │   └── healer.ts
│   ├── graph/
│   │   ├── state.ts
│   │   ├── workflow.ts
│   │   └── nodes.ts
│   ├── utils/
│   │   ├── accessibility.ts
│   │   ├── error-classifier.ts
│   │   ├── gemini-client.ts
│   │   └── healing-registry.ts
│   └── types/
│       └── index.ts
├── features/
│   ├── search.feature
│   └── step-definitions/
│       └── search.steps.ts
├── tests/
│   └── generated/
├── criteria/
│   └── search.md
├── healing-history.json
└── README.md
```

---

## Future TODOs
- [ ] Action-level healing (locator değil, akış değişikliği)
- [ ] Custom accessibility tree builder (daha zengin context)
- [ ] Multi-step test senaryoları (login → search → cart → checkout)
- [ ] CI/CD entegrasyonu (headless mode)
- [ ] Parallel test execution
- [ ] Visual regression entegrasyonu
- [ ] Healing confidence score (düşükse insan onayı iste)
- [ ] Dashboard / reporting UI
