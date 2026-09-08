# Family onboarding design preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver reviewable Home and Member Profile prototypes before mass implementation of onboarding screens.

**Architecture:** Standalone Next.js preview routes with local synthetic fixtures, isolated CSS module and no backend connection. Existing public landing stays functional; preview does not become an authenticated product route. No new dependency is required.

**Tech Stack:** Existing Next.js App Router, React, TypeScript, CSS tokens and Playwright.

**Spec:** [Approved onboarding scope](../specs/2026-09-08-onboarding.md), [UX requirements](../../05_UX_UI_GUIDELINES.md).

## Global Constraints

- Pilot 15 people; every preview datum is synthetic and visibly labeled.
- UI is Vietnamese UTF-8; minimum touch target 44 CSS px; normal body text 16 px or greater; preserve zoom and reduced motion.
- Album gia đình Việt đương đại is a proposal pending user visual approval.
- No purple/blue gradients, glassmorphism, decorative emoji, fake statistics, floating AI controls or generic dashboard card grids.
- No real contacts, external image requests, auth bypass, secrets or connection to family data.
- No dependency, lockfile, migration, API contract or existing navigation changes in this task.
- Subagents are GPT-5.6 Luna xhigh. One implementer; no child agents. Supervisor handles commits/integration if sandbox blocks Git.

## Task 1: Build and verify the visual preview

**Files:**

- Create: `apps/web/app/design-preview/page.tsx` — Home proposal.
- Create: `apps/web/app/design-preview/profile/page.tsx` — Member Profile proposal.
- Create: `apps/web/app/design-preview/preview.module.css` — scoped responsive layout.
- Create: `apps/web/app/design-preview/fixtures.ts` — explicit synthetic member data.
- Create: `apps/web/app/design-preview/preview-shell.tsx` — shared preview notice and links.
- Create: `tests/e2e/design-preview.spec.ts` — navigation and readability checks.

**Interfaces:**

- Consumes existing CSS custom properties from `@family/ui/tokens.css` via root layout; the skip link targets `id="main"` on each page.
- Produces GET `/design-preview` and `/design-preview/profile`; server components, no mutations or outbound requests.
- Shared shell signature: `PreviewShell({ children }: { children: ReactNode })`.
- Fixture minimum: `previewMember = { synthetic: true, displayName: 'Nguyễn Thị Thanh Hương', familiarName: 'Dì Hương', birthYear: 1972, hometown: 'Cần Thơ', biography: 'Thích chăm cây, nấu ăn và ghi lại những món ngon của nhà.' } as const`.

- [ ] **Step 1: Write browser checks before routes exist.** Catch broken navigation, unreadable overflow, missing prototype disclosure and browser errors; do not test arbitrary decoration. Use the existing two Playwright projects.

```ts
import { test, expect } from '@playwright/test';
test('preview links reach the profile without layout overflow', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/design-preview');
  await expect(page.getByText('Dữ liệu minh họa', { exact: false }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Xem hồ sơ Dì Hương' }).click();
  await expect(page).toHaveURL(/\/design-preview\/profile$/);
  await expect(page.getByRole('heading', { name: 'Nguyễn Thị Thanh Hương' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
```

- [ ] **Step 2: Run RED.** `npm run test:e2e -- tests/e2e/design-preview.spec.ts` against baseline build; expected failure because preview notice/routes do not exist. If environment blocks process spawn, report and use authorized escalation; do not change security settings or weaken tests.

- [ ] **Step 3: Implement the two pages.** Use semantic main/header/nav/section, meaningful headings, CSS grid for an editorial composition rather than repeated cards, scoped styles to avoid existing landing h1/footer rules. Home: small house identity and greeting, one upcoming synthetic gathering in a slim date strip, a story/album area with deliberate typographic treatment and a clearly labeled image placeholder, a short family directory with profile link. Profile: prominent familiar name and full name, graceful initials avatar, a short biography, year-only birth display, hometown, contact section explicitly saying contact information is not supplied in this preview. No tel/mailto links to invented numbers. Provide working Home/Profile links only; future calendar/chat/moment affordances must be explanatory text, not dead buttons. Neither fixture nor UI infers relationships.

```tsx
import type { ReactNode } from 'react';
import Link from 'next/link';
export function PreviewShell({ children }: { children: ReactNode }) {
  return (
    <>
      <aside aria-label="Thông tin bản mẫu">
        Bản mẫu thiết kế · Dữ liệu minh họa, không phải thông tin gia đình thật.
      </aside>
      <nav aria-label="Bản mẫu">
        <Link href="/design-preview">Nhà mình</Link>
        <Link href="/design-preview/profile">Hồ sơ</Link>
      </nav>
      {children}
    </>
  );
}
```

Extend this structure with the CSS module; give all links minimum height/width 44 px, visible focus, wrap long names, avoid fixed text-container heights. Layout should remain useful at 320 px and with 200% text. Use existing tokens for recurring color/spacing/radius. Do not add a fake photo simply to fill space; make missing-image state look intentional. Keep the preview notice readable but visually secondary.

- [ ] **Step 4: Verify GREEN and visual evidence.** Run `npm run build`, focused E2E, `npm run lint`, `npm run typecheck`. Capture full-page screenshots of both routes in desktop/mobile to `test-results/design-preview/`; inspect screenshots using view_image. Add a browser check that doubles root font size and asserts no horizontal overflow on both pages, then reset. Document contrast calculations for normal text pairs and any custom CSS colors. Run existing homepage E2E alongside focused tests at final verification. Report actual test outputs and any screenshot limitations.

- [ ] **Step 5: Self-review and handoff.** Read own diff for scope, accessibility, UTF-8 and misleading feature claims. Write the task report in the SDD workspace. Supervisor packages the diff for independent review, integrates and commits with `feat(web): add Vietnamese family design preview`. User visual approval remains pending even after automated tests and reviewer approval.
