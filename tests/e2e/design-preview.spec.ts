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

test('preview pages remain usable when browser text is enlarged to 200 percent', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  for (const route of ['/design-preview', '/design-preview/profile']) {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(route);
    if (route === '/design-preview') {
      await expect(page.getByRole('heading', { name: 'Chào cả nhà.' })).toBeVisible();
    } else {
      await expect(page.getByRole('heading', { name: 'Nguyễn Thị Thanh Hương' })).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const scalingStyle = await page.addStyleTag({
      content: `
        html { font-size: 200% !important; }
        body { font-size: 32px !important; }
      `,
    });

    const textElements = page.locator('body :is(h1, h2, h3, p, a, time, dt, dd, small, span)');
    const originalInlineStyles = await textElements.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('style')),
    );
    const originalFontSizes = await textElements.evaluateAll((elements) =>
      elements.map((element) => Number.parseFloat(window.getComputedStyle(element).fontSize)),
    );
    const originalHeadingSize = await page
      .locator('h1')
      .evaluate((element) => Number.parseFloat(window.getComputedStyle(element).fontSize));

    await textElements.evaluateAll((elements, fontSizes) => {
      elements.forEach((element, index) => {
        (element as HTMLElement).style.fontSize = `${fontSizes[index] * 2}px`;
      });
    }, originalFontSizes);

    const enlargedHeadingSize = await page
      .locator('h1')
      .evaluate((element) => Number.parseFloat(window.getComputedStyle(element).fontSize));
    expect(Math.abs(enlargedHeadingSize - originalHeadingSize * 2)).toBeLessThan(0.1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    await textElements.evaluateAll((elements, inlineStyles) => {
      elements.forEach((element, index) => {
        const originalStyle = inlineStyles[index];
        if (originalStyle === null) {
          element.removeAttribute('style');
        } else {
          element.setAttribute('style', originalStyle);
        }
      });
    }, originalInlineStyles);
    await scalingStyle.evaluate((style) => style.remove());
    const restoredHeadingSize = await page
      .locator('h1')
      .evaluate((element) => Number.parseFloat(window.getComputedStyle(element).fontSize));
    expect(Math.abs(restoredHeadingSize - originalHeadingSize)).toBeLessThan(0.1);
  }

  expect(errors).toEqual([]);
});
