# DealsRKY Testing Documentation

Welcome to the test suite for **DealsRKY Amazon Affiliate Bridge**. Since this is a high-performance Cloudflare-native platform, we utilize a dual-framework testing architecture.

## 🏗 Architecture

### 1. Vitest (Backend & Unit Tests)
- **Purpose**: Testing all `Hono` backend routes, Cloudflare `D1` Database queries, and `KV` caching layers without booting a full browser.
- **Why**: Blistering fast and shares the same Vite build pipeline as the source code. Uses `@cloudflare/vitest-pool-workers` to provide identical runtime behaviors to production Cloudflare Workers.
- **Location**: `test/unit/` and `test/integration/`
- **Command**: `npm run test`

### 2. Playwright (Frontend & E2E Tests)
- **Purpose**: Full browser visual testing, end-to-end flows spanning the frontend React Router navigation to the finalized API response.
- **Why**: Capable of mimicking real user actions. Tests Amazon Associates TOS compliance accurately.
- **Location**: `test/e2e/`
- **Command**: `npm run test:e2e`

## 📁 Directory Structure
- `test/e2e/`: Playwright visual browser specs.
- `test/unit/`: Vitest scripts testing raw functions and D1 bindings.
- `test/factories/`: Data generation tools leveraging Faker APIs (e.g. `agent.ts`).

## 🚀 Running Tests
- **All Core Unit Tests:** `npm run test`
- **All E2E Tests (Headless):** `npm run test:e2e`
- **E2E Tests with UI (Debug):** `npx playwright test --ui`

## 💡 Best Practices
1. **Never mutate global DB state in E2E:** Use factory wrappers or test cleanups in `beforeEach`/`afterEach` blocks.
2. **Select elements by explicit test ID:** When testing frontend UI, use `data-testid` rather than volatile structure like `.mt-4 div > span`.
3. **KV/D1 Binding Checks:** Ensure that Cloudflare mock workers are correctly initiated by importing `env` from `cloudflare:test`. (For example: `import { env } from "cloudflare:test";`).
