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

/** Seed a valid existing account/session before a case's single initial navigation. */
async function seedReader(page, posts = []) {
  const account = {
    id: 'seed-reader', username: 'seed-reader', displayName: 'Seed Reader', password: 'demo-only',
    role: 'user', createdAt: '2026-03-01T00:00:00.000Z',
  };
  const session = { userId: account.id, username: account.username, displayName: account.displayName, role: account.role };
  await page.addInitScript(({ account, session, posts }) => {
    localStorage.setItem('writespace_users', JSON.stringify([account]));
    localStorage.setItem('writespace_session', JSON.stringify(session));
    localStorage.setItem('writespace_posts', JSON.stringify(posts));
  }, { account, session, posts });
  return session;
}

test('authenticated nonowner initial edit deep link redirects exactly to blogs without changing the post', async ({ page }) => {
  const post = {
    id: '11111111-1111-4111-8111-111111111111', title: 'Another writer', content: 'Shared\nwriting',
    createdAt: '2026-03-04T12:00:00.000Z', authorId: 'another-writer', authorName: 'Another author',
  };
  const session = await seedReader(page, [post]);
  await page.goto(`/edit/${post.id}`);
  await expect(page).toHaveURL('/blogs');
  await expect(page.getByRole('heading', { name: 'All Blogs', exact: true })).toBeVisible();
  await expect(page.getByLabel('Title', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Content', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: `Edit ${post.title}`, exact: true })).toHaveCount(0);
  expect(await storedPosts(page)).toEqual([post]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(session);
  await page.getByRole('link', { name: `Read ${post.title}`, exact: true }).click();
  await expect(page).toHaveURL(`/blog/${post.id}`);
  await expect(page.getByRole('heading', { name: post.title, exact: true })).toBeVisible();
  await expect(page.locator('article .whitespace-pre-wrap')).toHaveText(post.content);
  await expect(page.getByRole('link', { name: 'Edit', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
  expect(await storedPosts(page)).toEqual([post]);
});

for (const path of ['/blog/missing', '/edit/missing']) {
  test(`authenticated missing post at ${path} offers a working back link`, async ({ page }) => {
    const session = await seedReader(page);
    await page.goto(path);
    await expect(page).toHaveURL(path);
    await expect(page.getByRole('heading', { name: 'Post not found', exact: true })).toBeVisible();
    await expect(page.getByLabel('Title', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Back to All Posts', exact: true })).toHaveAttribute('href', '/blogs');
    await page.getByRole('link', { name: 'Back to All Posts', exact: true }).click();
    await expect(page).toHaveURL('/blogs');
    await expect(page.getByRole('heading', { name: 'All Blogs', exact: true })).toBeVisible();
    expect(await storedPosts(page)).toEqual([]);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(session);
  });
}

test('empty list own Write CTA opens the actual form and creates a readable post', async ({ page }) => {
  const session = await seedReader(page);
  await page.goto('/blogs');
  await expect(page.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
  await page.getByRole('main').getByRole('link', { name: 'Write', exact: true }).click();
  await expect(page).toHaveURL('/write');
  await expect(page.getByRole('heading', { name: 'Write a Blog', exact: true })).toBeVisible();
  await expect(page.getByLabel('Title')).toHaveValue('');
  await expect(page.getByLabel('Content')).toHaveValue('');
  await page.getByLabel('Title').fill('First from the list');
  const content = 'Created from the empty invitation.\nSecond line';
  await page.getByLabel('Content').fill(content);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const posts = await storedPosts(page);
  expect(posts).toHaveLength(1);
  expect(posts[0]).toMatchObject({ title: 'First from the list', content, authorId: session.userId, authorName: session.displayName });
  await expect(page).toHaveURL(`/blog/${posts[0].id}`);
  await expect(page.getByRole('heading', { name: posts[0].title, exact: true })).toBeVisible();
  await expect(page.locator('article .whitespace-pre-wrap')).toHaveText(content);
  await page.getByRole('link', { name: 'Back to All Posts', exact: true }).click();
  await expect(page).toHaveURL('/blogs');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('link', { name: `Read ${posts[0].title}`, exact: true })).toBeVisible();
  await expect(page.getByText('No blogs yet. Be the first to write one!')).toHaveCount(0);
  expect(await storedPosts(page)).toEqual(posts);
});

test('authenticated initial write entry opens an empty form and Cancel returns to blogs without saving', async ({ page }) => {
  await seedReader(page);
  await page.goto('/write');
  await expect(page).toHaveURL('/write');
  await expect(page.getByRole('heading', { name: 'Write a Blog', exact: true })).toBeVisible();
  await expect(page.getByLabel('Title')).toHaveValue('');
  await expect(page.getByLabel('Content')).toHaveValue('');
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  await expect(page).toHaveURL('/blogs');
  await expect(page.getByRole('heading', { name: 'All Blogs', exact: true })).toBeVisible();
  expect(await storedPosts(page)).toEqual([]);
});

for (const { name, width, columns } of [
  { name: 'mobile', width: 390, columns: 1 },
  { name: 'tablet', width: 820, columns: 2 },
  { name: 'desktop', width: 1280, columns: 3 },
]) {
  test(`${name} blog grid renders ${columns} computed columns with seeded posts`, async ({ page }) => {
    const posts = Array.from({ length: 6 }, (_, index) => ({
      id: `grid-post-${index}`, title: `Grid story ${index}`, content: `Grid content ${index}`,
      authorId: 'seed-reader', authorName: 'Seed Reader', createdAt: `2026-03-0${index + 1}T12:00:00.000Z`,
    }));
    await page.setViewportSize({ width, height: 900 });
    await seedReader(page, posts);
    await page.goto('/blogs');
    await expect(page).toHaveURL('/blogs');
    const cards = page.getByRole('main').getByRole('article');
    await expect(cards).toHaveCount(posts.length);
    for (const post of posts) {
      await expect(page.getByRole('heading', { name: post.title, exact: true })).toBeVisible();
    }
    await expect.poll(() => cards.first().evaluate(card => {
      const style = getComputedStyle(card.parentElement);
      return { display: style.display, columns: style.gridTemplateColumns.trim().split(/\s+/).length };
    })).toEqual({ display: 'grid', columns });
    expect(await storedPosts(page)).toEqual(posts);
    await page.getByRole('link', { name: `Read ${posts[5].title}`, exact: true }).click();
    await expect(page).toHaveURL(`/blog/${posts[5].id}`);
    await expect(page.getByRole('heading', { name: posts[5].title, exact: true })).toBeVisible();
    await expect(page.locator('article .whitespace-pre-wrap')).toHaveText(posts[5].content);
  });
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
  await expect(page).toHaveURL('/admin');
  await expect(page.getByRole('heading', { name: 'Admin Dashboard', exact: true })).toBeVisible();
  await navigateWorkspace(page, 'All Blogs');
  await expect(page).toHaveURL('/blogs');
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
