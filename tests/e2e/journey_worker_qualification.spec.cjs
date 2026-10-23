'use strict';
const fs = require('fs');
const { test, expect } = require('@playwright/test');
test.afterEach(async ({ page }, info) => {
  await page.screenshot({ path: info.outputPath('final-state.png') });
});
for (const width of [1280, 360])
  test(`J-WORKER-QUALIFICATION owner persistence and denied mutation at ${width}px`, async ({
    page,
    request
  }, info) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('http://127.0.0.1:4400');
    const token = fs.readFileSync('/fixture/token', 'utf8');
    const value = 'verified-' + width;
    await page.getByLabel('Fixture credential').fill(token);
    await page.getByLabel('New value').fill(value);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Saved');
    await page.screenshot({ path: info.outputPath('saved-' + width + '.png') });
    await page.reload();
    await expect(page.locator('#value')).toHaveText(value);
    expect((await (await request.get('http://127.0.0.1:4400/api')).json()).value).toBe(value);
    await page.getByLabel('Fixture credential').fill('deliberately-wrong');
    await page.getByLabel('New value').fill('must-not-persist');
    const response = page.waitForResponse((r) => r.url().endsWith('/api') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    expect((await response).status()).toBe(403);
    await expect(page.getByRole('status')).toHaveText('Forbidden');
    await page.screenshot({ path: info.outputPath('forbidden-' + width + '.png') });
    expect((await (await request.get('http://127.0.0.1:4400/api')).json()).value).toBe(value);
    await page.reload();
    await expect(page.locator('#value')).toHaveText(value);
    await page.getByLabel('Fixture credential').fill(token);
    await page.getByLabel('New value').fill(value + '-again');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Saved');
    expect((await (await request.get('http://127.0.0.1:4400/api')).json()).value).toBe(value + '-again');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(page.getByRole('status')).toBeInViewport();
  });
