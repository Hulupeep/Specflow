import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Journey: ChatGPT Quick Send', () => {
  test('J-CHAT-QUICK: Injects button and sends to GitHub', async ({ page }) => {
    // 1. Load Simulation Page
    const fixturePath = `file://${path.resolve(__dirname, 'fixtures/chatgpt-sim.html')}`;
    await page.goto(fixturePath);

    // 2. Inject Content Script Manually (Simulating Extension)
    const contentScriptPath = path.resolve(__dirname, '../../packages/extension/src/content/chatgptContentScript.ts');
    // Simple TS-to-JS strip for valid browser execution (removing types)
    let scriptContent = fs.readFileSync(contentScriptPath, 'utf-8');
    scriptContent = scriptContent.replace(/: string/g, ''); // Strip type annotation

    await page.addScriptTag({ content: scriptContent });

    // 3. Wait for Extension to Inject Button
    const sendButton = page.locator('.chat2repo-button').first();
    await expect(sendButton).toBeVisible({ timeout: 5000 });

    // 4. Click the button
    await sendButton.click();

    // 5. Verify Toast Feedback
    const toast = page.locator('.chat2repo-toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Saved to');
  });
});
