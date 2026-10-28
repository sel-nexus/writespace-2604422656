/** Capture successful representative views for structural and human review. */
import { test, expect } from './fixtures.js';
import fs from 'node:fs/promises';

/** Save browser text evidence and a screenshot without judging pixels. */
async function capture(page, info, name) {
  const evidence = {
    accessibility: await page.locator('body').ariaSnapshot(),
    styles: await page.evaluate(() => ({
      bodyFont: getComputedStyle(document.querySelector('#root > div')).fontFamily,
      headingFont: getComputedStyle(document.querySelector('h1')).fontFamily,
      background: getComputedStyle(document.querySelector('#root > div')).backgroundColor,
      width: innerWidth, documentWidth: document.documentElement.scrollWidth
    })),
    html: await page.content()
  };
  await fs.writeFile(info.outputPath(`${name}.json`), JSON.stringify(evidence, null, 2));
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
  expect(evidence.styles.documentWidth).toBeLessThanOrEqual(evidence.styles.width);
}

test('capture desktop public empty and login error states', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'WriteSpace', exact: true })).toBeVisible();
  await capture(page, info, 'public-desktop-empty');
  await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByText('Username is required.', { exact: true })).toBeVisible();
  await capture(page, info, 'login-errors');
});

test('capture mobile open navigation and populated administrator workspace', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Admin Dashboard', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await capture(page, info, 'admin-mobile-navigation');
  await page.getByRole('link', { name: 'Users', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Manage Users', exact: true })).toBeVisible();
  await capture(page, info, 'users-mobile');
});
