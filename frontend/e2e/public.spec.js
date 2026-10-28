/** Exercise public entry journeys after the parent wires identity and protected post routes. */
import { test, expect } from './fixtures.js';

test('a guest starts reading through the login entry', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'WriteSpace' })).toBeVisible();
  await expect(page.getByText('Your thoughts. Your space. Beautifully simple.')).toBeVisible();
  await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
});

test('a guest chooses registration from the landing CTA', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Get Started Free', exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByLabel('Display Name', { exact: true })).toBeVisible();
});

test('a guest opens a locally stored preview and is required to log in', async ({ page }) => {
  const post = {
    id: '8f6c4f92-395a-4b3b-a82c-9b7d426ee897',
    title: 'A thought from this browser',
    content: 'This saved thought appears in the public preview before a guest can read the full post.',
    createdAt: '2026-03-04T12:00:00.000Z',
    authorId: 'admin',
    authorName: 'Admin',
  };
  await page.addInitScript(record => {
    localStorage.removeItem('writespace_session');
    localStorage.setItem('writespace_posts', JSON.stringify([record]));
  }, post);
  await page.goto('/');
  const preview = page.getByRole('link', { name: post.title, exact: true });
  await expect(preview).toHaveAttribute('href', `/blog/${post.id}`);
  await expect(page.getByText(post.content, { exact: true })).toBeVisible();
  await preview.click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([post]);
});
