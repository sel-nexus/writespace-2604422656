/** Exercise public entry journeys with real local data and the console-error fixture. */
import { test, expect } from './fixtures.js';

/** Seed production localStorage schemas before the test's single entry navigation. */
async function seedPublic(page, role = null, posts = []) {
  const writer = {
    id: 'public-writer', username: 'public-writer', displayName: 'Mira',
    password: 'local-demo-only', role: 'user', createdAt: '2026-01-01T00:00:00Z',
  };
  const session = role === 'admin'
    ? { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' }
    : role === 'user'
      ? { userId: writer.id, username: writer.username, displayName: writer.displayName, role: 'user' }
      : null;
  await page.addInitScript(({ writer, session, posts }) => {
    localStorage.setItem('writespace_users', JSON.stringify([writer]));
    localStorage.setItem('writespace_posts', JSON.stringify(posts));
    if (session) localStorage.setItem('writespace_session', JSON.stringify(session));
    else localStorage.removeItem('writespace_session');
  }, { writer, session, posts });
}

/** Verify the writing invitation is a usable entry, not merely decoration. */
for (const role of [null, 'user', 'admin']) {
  test(`writing invitation opens the real form for ${role || 'guest'}`, async ({ page }) => {
    await seedPublic(page, role);
    await page.goto('/');
    await page.getByRole('link', { name: 'Open your writing space', exact: true }).click();
    if (!role) {
      await expect(page).toHaveURL(/\/register$/);
      await expect(page.getByLabel('Display Name', { exact: true })).toBeVisible();
    } else {
      await expect(page).toHaveURL(/\/write$/);
      await page.getByLabel('Title', { exact: true }).fill('Invitation thought');
      await page.getByLabel('Content', { exact: true }).fill('Written from the public invitation.');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page).toHaveURL(/\/blog\//);
      await expect(page.getByRole('heading', { name: 'Invitation thought', exact: true })).toBeVisible();
      const posts = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')));
      expect(posts).toHaveLength(1);
      expect(posts[0].authorId).toBe(role === 'admin' ? 'admin' : 'public-writer');
      expect(posts[0].authorName).toBe(role === 'admin' ? 'Admin' : 'Mira');
    }
  });
}

const unsortedPosts = [
  { id: 'oldest', title: 'Oldest local thought', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'middle', title: 'Middle local thought', createdAt: '2026-03-01T00:00:00Z' },
  { id: 'newest', title: 'Newest local thought', createdAt: '2026-03-05T00:00:00Z' },
  { id: 'next', title: 'Next newest local thought', createdAt: '2026-03-04T00:00:00Z' },
].map(post => ({
  ...post, content: `Saved content for ${post.title}.`, authorId: 'admin', authorName: 'Admin',
}));

for (const role of ['admin', 'user']) {
  test(`authenticated ${role} clicks Start Reading to shared blogs`, async ({ page }) => {
    await seedPublic(page, role, unsortedPosts);
    await page.goto('/');
    await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
    await expect(page).toHaveURL(/\/blogs$/);
    await expect(page.getByRole('heading', { level: 1, name: 'All Blogs' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Oldest local thought', exact: true })).toBeVisible();
    await expect(page.getByText('Saved content for Oldest local thought.', { exact: true })).toBeVisible();
  });

  for (const surface of ['hero', 'navbar']) {
    test(`authenticated ${role} clicks ${surface} Go to Dashboard to the role workspace`, async ({ page }) => {
      await seedPublic(page, role, unsortedPosts);
      await page.goto('/');
      const container = surface === 'hero'
        ? page.getByRole('main')
        : page.getByRole('navigation', { name: 'Public navigation' });
      await container.getByRole('link', { name: 'Go to Dashboard', exact: true }).click();
      await expect(page).toHaveURL(role === 'admin' ? /\/admin$/ : /\/blogs$/);
      await expect(page.getByRole('heading', {
        level: 1, name: role === 'admin' ? 'Admin Dashboard' : 'All Blogs', exact: true,
      })).toBeVisible();
      if (role === 'admin') {
        await expect(page.getByRole('heading', { name: 'Recent Posts', exact: true })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Manage Users', exact: true })).toBeVisible();
      }
      await expect(page.getByRole('link', {
        name: role === 'admin' ? 'Newest local thought' : 'Read Newest local thought', exact: true,
      })).toBeVisible();
    });
  }
}

for (const [label, role, destination] of [
  ['Home', null, '/'],
  ['All Blogs', 'user', '/blogs'],
  ['Login', null, '/login'],
  ['Register', null, '/register'],
]) {
  test(`footer ${label} opens its meaningful destination`, async ({ page }) => {
    await seedPublic(page, role, unsortedPosts);
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Footer navigation' })
      .getByRole('link', { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${destination}$`));
    if (label === 'Home') {
      await expect(page.getByRole('heading', { level: 1, name: 'WriteSpace' })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Latest from the Blog' })
        .getByRole('link', { name: 'Newest local thought', exact: true })).toBeVisible();
    } else if (label === 'All Blogs') {
      await expect(page.getByRole('heading', { level: 1, name: 'All Blogs' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Oldest local thought', exact: true })).toBeVisible();
    } else {
      await expect(page.getByLabel(label === 'Login' ? 'Username' : 'Display Name', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
  });
}

test('public empty storage shows the invitation instead of post previews', async ({ page }) => {
  await seedPublic(page);
  await page.goto('/');
  const latest = page.getByRole('region', { name: 'Latest from the Blog' });
  await expect(latest.getByText('No posts yet — check back soon!', { exact: true })).toBeVisible();
  await expect(latest.getByRole('heading', { level: 3 })).toHaveCount(0);
  await page.getByRole('link', { name: 'Get Started Free', exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByLabel('Display Name', { exact: true })).toBeVisible();
});

test('public previews sort four unsorted posts newest-first and stop at three', async ({ page }) => {
  await seedPublic(page, null, unsortedPosts);
  await page.goto('/');
  const latest = page.getByRole('region', { name: 'Latest from the Blog' });
  await expect(latest.getByRole('heading', { level: 3 })).toHaveText([
    'Newest local thought', 'Next newest local thought', 'Middle local thought',
  ]);
  await expect(latest.getByRole('link')).toHaveCount(3);
  await expect(latest.getByText('Oldest local thought', { exact: true })).toHaveCount(0);
  await expect(latest.getByText('Mar 05, 2026', { exact: true })).toBeVisible();
  await expect(latest.getByText('Saved content for Newest local thought.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(unsortedPosts);
  await latest.getByRole('link', { name: 'Newest local thought', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
});

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
