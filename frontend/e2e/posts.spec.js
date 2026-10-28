/** Exercise real UI post operations and persisted data with automatic console checks. */
import { test, expect } from './fixtures.js';

/** Register a writer through the public navigation and registration form. */
async function registerWriter(page, name, username) {
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Get Started' }).click();
  await page.getByLabel('Display Name').fill(name);
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password', { exact: true }).fill('demo-only');
  await page.getByLabel('Confirm Password').fill('demo-only');
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
}

/** Open desktop or mobile workspace navigation before following a visible link. */
async function navigateWorkspace(page, label) {
  const nav = page.getByRole('navigation', { name: 'Workspace navigation' });
  const toggle = nav.getByRole('button', { name: 'Open navigation' });
  if (await toggle.isVisible()) await toggle.click();
  await nav.getByRole('link', { name: label, exact: true }).click();
}

/** Log out through the account disclosure, never by mutating the session fixture. */
async function logout(page, name) {
  const nav = page.getByRole('navigation', { name: 'Workspace navigation' });
  const toggle = nav.getByRole('button', { name: 'Open navigation' });
  if (await toggle.isVisible()) await toggle.click();
  await nav.getByRole('button', { name: `Account: ${name}` }).click();
  await nav.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** Read actual persisted posts after each operation. */
async function storedPosts(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')) || []);
}

test('registration to create/read/reload/cancel/update/delete preserves correct local data', async ({ page }) => {
  await page.goto('/');
  await registerWriter(page, 'Mira', 'mira');
  await expect(page.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
  await navigateWorkspace(page, 'Write');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Title is required.')).toBeVisible();
  await expect(page.getByText('Content is required.')).toBeVisible();
  expect(await storedPosts(page)).toEqual([]);
  const content = 'First line\n\n<script>alert(1)</script>\nLast line';
  await page.getByLabel('Title').fill('Local story');
  await page.getByLabel('Content').fill(content);
  await expect(page.getByRole('status')).toHaveText(`${content.length} characters`);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Local story', exact: true })).toBeVisible();
  const [original] = await storedPosts(page);
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')));
  expect(original).toMatchObject({ title: 'Local story', content, authorId: session.userId, authorName: 'Mira' });
  expect(original.id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
  expect(new Date(original.createdAt).toISOString()).toBe(original.createdAt);
  await expect(page).toHaveURL(new RegExp(`/blog/${original.id}$`));
  await expect(page.locator('article .whitespace-pre-wrap')).toHaveText(content);
  await expect(page.locator('article script')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Local story', exact: true })).toBeVisible();
  expect(await storedPosts(page)).toEqual([original]);
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Title')).toHaveValue(original.title);
  await expect(page.getByLabel('Content')).toHaveValue(original.content);
  await page.getByLabel('Title').fill('Cancelled');
  await page.getByRole('link', { name: 'Cancel' }).click();
  expect(await storedPosts(page)).toEqual([original]);
  await expect(page.getByRole('heading', { name: 'Local story', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Title').fill('Updated story');
  await page.getByLabel('Content').fill('Updated\nplaintext');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Updated story' })).toBeVisible();
  const updated = { ...original, title: 'Updated story', content: 'Updated\nplaintext' };
  expect(await storedPosts(page)).toEqual([updated]);
  page.once('dialog', async dialog => {
    expect(dialog.type()).toBe('confirm');
    await dialog.dismiss();
  });
  await page.getByRole('button', { name: 'Delete' }).click();
  expect(await storedPosts(page)).toEqual([updated]);
  await expect(page.getByRole('heading', { name: 'Updated story' })).toBeVisible();
  page.once('dialog', async dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  expect(await storedPosts(page)).toEqual([]);
  await expect(page.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
});

test('another user logs in to read without controls; admin logs in to edit another author', async ({ page }) => {
  await page.goto('/');
  await registerWriter(page, 'Reader', 'reader');
  await logout(page, 'Reader');
  // Establish only another author's post. All identity and post operations use the real UI.
  const seeded = {
    id: '11111111-1111-4111-8111-111111111111', title: 'Another writer', content: 'Shared\nwriting',
    createdAt: '2026-03-04T12:00:00.000Z', authorId: 'another-writer', authorName: 'Another author',
  };
  await page.evaluate(post => localStorage.setItem('writespace_posts', JSON.stringify([post])), seeded);
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login' }).click();
  await page.getByLabel('Username').fill('reader');
  await page.getByLabel('Password').fill('demo-only');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByRole('link', { name: 'Edit Another writer' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Read Another writer' }).click();
  await expect(page.getByRole('heading', { name: 'Another writer', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Edit', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0);
  expect(await storedPosts(page)).toEqual([seeded]);
  await logout(page, 'Reader');
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login' }).click();
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password').fill('admin');
  await page.getByRole('button', { name: 'Login' }).click();
  // The administrator landing is owned by the next slice; either shell offers a reading path.
  const publicNav = page.getByRole('navigation', { name: 'Public navigation' });
  if (await publicNav.isVisible()) await page.getByRole('link', { name: 'Start Reading' }).click();
  else await navigateWorkspace(page, 'All Blogs');
  await page.getByRole('link', { name: 'Edit Another writer' }).click();
  await expect(page.getByLabel('Title')).toHaveValue(seeded.title);
  await page.getByLabel('Title').fill('Admin revision');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Admin revision' })).toBeVisible();
  expect(await storedPosts(page)).toEqual([{ ...seeded, title: 'Admin revision' }]);
  page.once('dialog', async dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  expect(await storedPosts(page)).toEqual([]);
});

for (const path of ['/blogs', '/blog/missing', '/write', '/edit/missing']) {
  test(`guest initial deep link ${path} redirects to login`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
    expect(await storedPosts(page)).toEqual([]);
  });
}
