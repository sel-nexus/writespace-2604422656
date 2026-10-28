/** Exercise administrator account and cross-feature post journeys through real UI actions. */
import { test, expect } from './fixtures.js';

/** Sign in via public navigation rather than injecting session data. */
async function login(page, username = 'admin', password = 'admin') {
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login' }).click();
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
}

/** Follow a visible workspace link on desktop or mobile. */
async function navigate(page, label) {
  const nav = page.getByRole('navigation', { name: 'Workspace navigation' });
  const toggle = nav.getByRole('button', { name: 'Open navigation' });
  if (await toggle.isVisible()) await toggle.click();
  await nav.getByRole('link', { name: label, exact: true }).click();
}

/** Log out through the real account disclosure. */
async function logout(page, name) {
  const nav = page.getByRole('navigation', { name: 'Workspace navigation' });
  const toggle = nav.getByRole('button', { name: 'Open navigation' });
  if (await toggle.isVisible()) await toggle.click();
  await nav.getByRole('button', { name: `Account: ${name}` }).click();
  await nav.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** Create a demo account using the required administrator form. */
async function createAccount(page, name, username, role) {
  await page.getByLabel('Display Name').fill(name);
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill('demo-only');
  await page.getByLabel('Role').selectOption(role);
  await page.getByRole('button', { name: 'Create User' }).click();
  await expect(page.getByRole('status')).toContainText(`Account created for ${name}.`);
}

/** Return the responsive, visible deletion button, not the hidden duplicate layout. */
function deleteButton(page, username) {
  return page.locator(`button[aria-label="Delete ${username}"]:visible`);
}

/** Read saved records for outcome assertions without modifying application state. */
async function stored(page, collection) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(`writespace_${key}`)) || [], collection);
}

/** Check true dashboard counts by their accessible statistic regions. */
async function counts(page, posts, accounts, admins, writers) {
  for (const [label, value] of [
    ['Total Posts', posts], ['Total Accounts', accounts], ['Total Admins', admins], ['Total Writers', writers],
  ]) {
    await expect(page.getByRole('region', { name: label }).locator('p')).toHaveText(String(value));
  }
}

test('admin creates both roles, rejects invalid/duplicate fields, protects default/self and persists confirmed deletion', async ({ page }) => {
  await page.goto('/');
  await login(page);
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
  await counts(page, 0, 1, 1, 0);
  await page.getByRole('link', { name: 'Manage Users' }).click();
  await expect(page.getByRole('heading', { name: 'Manage Users' })).toBeVisible();
  await expect(page.getByText(/Do not use real passwords/)).toBeVisible();
  await page.getByRole('button', { name: 'Create User' }).click();
  for (const message of ['Display name is required.', 'Username is required.', 'Password is required.', 'Role is required.']) {
    await expect(page.getByText(message)).toBeVisible();
  }
  expect(await stored(page, 'users')).toEqual([]);
  await createAccount(page, 'Mira', 'mira', 'user');
  await createAccount(page, 'Editor', 'editor', 'admin');
  const accounts = await stored(page, 'users');
  expect(accounts.map(account => account.role)).toEqual(['user', 'admin']);
  for (const account of accounts) {
    expect(account.id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
    expect(new Date(account.createdAt).toISOString()).toBe(account.createdAt);
  }
  await page.getByLabel('Display Name').fill('Duplicate');
  await page.getByLabel('Password').fill('demo-only');
  await page.getByLabel('Role').selectOption('user');
  for (const username of ['admin', 'mira']) {
    await page.getByLabel('Username').fill(username);
    await page.getByRole('button', { name: 'Create User' }).click();
    await expect(page.getByText('Username is already taken.')).toBeVisible();
    expect(await stored(page, 'users')).toEqual(accounts);
  }
  await expect(deleteButton(page, 'admin')).toBeDisabled();
  await expect(deleteButton(page, 'admin')).toHaveAttribute('title', 'Default admin cannot be deleted.');
  page.once('dialog', async dialog => {
    expect(dialog.type()).toBe('confirm');
    await dialog.dismiss();
  });
  await deleteButton(page, 'mira').click();
  expect(await stored(page, 'users')).toEqual(accounts);
  page.once('dialog', async dialog => dialog.accept());
  await deleteButton(page, 'mira').click();
  await expect(page.getByRole('heading', { name: 'Accounts (2)' })).toBeVisible();
  expect(await stored(page, 'users')).toEqual([accounts[1]]);
  await navigate(page, 'Admin Dashboard');
  await counts(page, 0, 2, 2, 0);
  await logout(page, 'Admin');
  await login(page, 'editor', 'demo-only');
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
  await page.getByRole('link', { name: 'Manage Users' }).click();
  await expect(deleteButton(page, 'editor')).toBeDisabled();
  await expect(deleteButton(page, 'editor')).toHaveAttribute('title', 'You cannot delete your own account.');
  await expect(deleteButton(page, 'admin')).toBeDisabled();
  expect(await stored(page, 'users')).toEqual([accounts[1]]);
});

test('admin account creation flows into writer login/post and admin dashboard counts/edit/delete with historical author retained', async ({ page }) => {
  await page.goto('/');
  await login(page);
  await page.getByRole('link', { name: 'Manage Users' }).click();
  await createAccount(page, 'Mira', 'mira', 'user');
  const [account] = await stored(page, 'users');
  await logout(page, 'Admin');
  await login(page, 'mira', 'demo-only');
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('link', { name: 'Admin Dashboard', exact: true })).toHaveCount(0);
  await navigate(page, 'Write');
  await page.getByLabel('Title').fill('Mira’s local story');
  await page.getByLabel('Content').fill('Original historical writing.');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Mira’s local story' })).toBeVisible();
  const [original] = await stored(page, 'posts');
  expect(original).toMatchObject({ authorId: account.id, authorName: 'Mira', content: 'Original historical writing.' });
  await logout(page, 'Mira');
  await login(page);
  await counts(page, 1, 2, 1, 1);
  const recent = page.getByRole('region', { name: 'Recent Posts' });
  await expect(recent.getByRole('link', { name: 'Mira’s local story', exact: true })).toBeVisible();
  await recent.getByRole('link', { name: 'Edit Mira’s local story' }).click();
  await expect(page.getByLabel('Title')).toHaveValue(original.title);
  await page.getByLabel('Title').fill('Admin revision');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Admin revision' })).toBeVisible();
  expect(await stored(page, 'posts')).toEqual([{ ...original, title: 'Admin revision' }]);
  await navigate(page, 'Users');
  page.once('dialog', async dialog => dialog.accept());
  await deleteButton(page, 'mira').click();
  expect(await stored(page, 'users')).toEqual([]);
  expect(await stored(page, 'posts')).toEqual([{ ...original, title: 'Admin revision' }]);
  await navigate(page, 'Admin Dashboard');
  await counts(page, 1, 1, 1, 0);
  await expect(page.getByRole('region', { name: 'Recent Posts' })).toContainText('Mira');
  page.once('dialog', async dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete Admin revision' }).click();
  expect(await stored(page, 'posts')).toHaveLength(1);
  page.once('dialog', async dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete Admin revision' }).click();
  await counts(page, 0, 1, 1, 0);
  await expect(page.getByText('No posts yet. Write your first post to begin.')).toBeVisible();
  expect(await stored(page, 'posts')).toEqual([]);
  await navigate(page, 'All Blogs');
  await navigate(page, 'Admin Dashboard');
  await counts(page, 0, 1, 1, 0);
  expect(await stored(page, 'posts')).toEqual([]);
});

test('dashboard Write New Post quick action saves an administrator-authored post and updates recent activity', async ({ page }) => {
  await page.goto('/');
  await login(page);
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
  await counts(page, 0, 1, 1, 0);
  await page.getByRole('navigation', { name: 'Quick actions' }).getByRole('link', { name: 'Write New Post' }).click();
  await expect(page).toHaveURL(/\/write$/);
  await expect(page.getByRole('heading', { name: 'Write a Blog' })).toBeVisible();
  const title = 'Notes from the administrator';
  const content = 'A dashboard-created story.\nIts second paragraph must survive saving.';
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Content').fill(content);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  const posts = await stored(page, 'posts');
  expect(posts).toHaveLength(1);
  const [post] = posts;
  expect(post).toMatchObject({ title, content, authorId: 'admin', authorName: 'Admin' });
  expect(post.id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
  expect(new Date(post.createdAt).toISOString()).toBe(post.createdAt);
  await expect(page).toHaveURL(new RegExp(`/blog/${post.id}$`));
  await navigate(page, 'Admin Dashboard');
  await counts(page, 1, 1, 1, 0);
  const recent = page.getByRole('region', { name: 'Recent Posts' });
  await expect(recent.getByRole('link', { name: title, exact: true })).toBeVisible();
  await expect(recent).toContainText('Admin');
  expect(await stored(page, 'posts')).toEqual(posts);
});

test('initial admin dashboard shows only the newest five of seven unsorted posts and supports edit/delete with backfill', async ({ page }) => {
  const posts = [3, 7, 1, 5, 2, 6, 4].map(day => ({
    id: `seed-post-${day}`, title: `Seed story ${day}`, content: `Stored story for January ${day}.`,
    authorId: 'admin', authorName: 'Admin', createdAt: `2025-01-0${day}T12:00:00.000Z`,
  }));
  await page.addInitScript(records => {
    localStorage.setItem('writespace_posts', JSON.stringify(records));
    localStorage.setItem('writespace_users', JSON.stringify([]));
    localStorage.setItem('writespace_session', JSON.stringify({
      userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin',
    }));
  }, posts);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
  await counts(page, 7, 1, 1, 0);
  const recent = page.getByRole('region', { name: 'Recent Posts' });
  const titles = recent.locator('li').locator('a').filter({ hasNotText: /^Edit$/ });
  await expect(recent.getByRole('listitem')).toHaveCount(5);
  await expect(titles).toHaveText(['Seed story 7', 'Seed story 6', 'Seed story 5', 'Seed story 4', 'Seed story 3']);
  await expect(recent.getByRole('link', { name: 'Seed story 1', exact: true })).toHaveCount(0);
  await expect(recent.getByRole('link', { name: 'Seed story 2', exact: true })).toHaveCount(0);
  expect(await stored(page, 'posts')).toEqual(posts);
  const original = posts.find(post => post.id === 'seed-post-7');
  await recent.getByRole('link', { name: 'Edit Seed story 7' }).click();
  await expect(page).toHaveURL(/\/edit\/seed-post-7$/);
  await expect(page.getByLabel('Title')).toHaveValue(original.title);
  await expect(page.getByLabel('Content')).toHaveValue(original.content);
  await page.getByLabel('Title').fill('Revised newest story');
  await page.getByLabel('Content').fill('Administrator revision of the newest seeded story.');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Revised newest story' })).toBeVisible();
  const updated = posts.map(post => post.id === original.id
    ? { ...post, title: 'Revised newest story', content: 'Administrator revision of the newest seeded story.' } : post);
  expect(await stored(page, 'posts')).toEqual(updated);
  await navigate(page, 'Admin Dashboard');
  await counts(page, 7, 1, 1, 0);
  await expect(titles).toHaveText(['Revised newest story', 'Seed story 6', 'Seed story 5', 'Seed story 4', 'Seed story 3']);
  page.once('dialog', async dialog => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toBe('Delete "Revised newest story"? This cannot be undone.');
    await dialog.dismiss();
  });
  await recent.getByRole('button', { name: 'Delete Revised newest story' }).click();
  expect(await stored(page, 'posts')).toEqual(updated);
  await expect(titles).toHaveText(['Revised newest story', 'Seed story 6', 'Seed story 5', 'Seed story 4', 'Seed story 3']);
  page.once('dialog', async dialog => dialog.accept());
  await recent.getByRole('button', { name: 'Delete Revised newest story' }).click();
  await counts(page, 6, 1, 1, 0);
  await expect(titles).toHaveText(['Seed story 6', 'Seed story 5', 'Seed story 4', 'Seed story 3', 'Seed story 2']);
  await expect(recent.getByRole('button', { name: 'Delete Revised newest story' })).toHaveCount(0);
  const remaining = updated.filter(post => post.id !== original.id);
  expect(await stored(page, 'posts')).toEqual(remaining);
  await navigate(page, 'All Blogs');
  await navigate(page, 'Admin Dashboard');
  await counts(page, 6, 1, 1, 0);
  await expect(titles).toHaveText(['Seed story 6', 'Seed story 5', 'Seed story 4', 'Seed story 3', 'Seed story 2']);
  expect(await stored(page, 'posts')).toEqual(remaining);
});

for (const [layout, viewport] of [
  ['mobile', { width: 390, height: 844 }],
  ['desktop', { width: 1280, height: 900 }],
]) {
  test(`${layout} account layout renders seeded identity details and protects default/self while allowing confirmed writer deletion`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const editor = {
      id: 'seed-editor', displayName: 'Seeded Editor', username: 'seed_editor', password: 'demo-only',
      role: 'admin', createdAt: '2025-02-03T12:00:00.000Z',
    };
    const writer = {
      id: 'seed-writer', displayName: 'Seeded Writer', username: 'seed_writer', password: 'demo-only',
      role: 'user', createdAt: '2025-02-04T12:00:00.000Z',
    };
    await page.addInitScript(accounts => {
      localStorage.setItem('writespace_users', JSON.stringify(accounts));
      localStorage.setItem('writespace_posts', JSON.stringify([]));
      localStorage.setItem('writespace_session', JSON.stringify({
        userId: accounts[0].id, username: accounts[0].username,
        displayName: accounts[0].displayName, role: accounts[0].role,
      }));
    }, [editor, writer]);
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
    await counts(page, 0, 3, 2, 1);
    await page.getByRole('navigation', { name: 'Quick actions' }).getByRole('link', { name: 'Manage Users' }).click();
    await expect(page.getByRole('heading', { name: 'Accounts (3)' })).toBeVisible();
    const table = page.getByRole('table', { name: 'User accounts', includeHidden: true });
    const cards = page.getByLabel('User account cards', { exact: true });
    if (layout === 'mobile') {
      await expect(cards).toBeVisible();
      await expect(table).toBeHidden();
      await expect(cards.getByRole('article')).toHaveCount(3);
    } else {
      await expect(table).toBeVisible();
      await expect(cards).toBeHidden();
      await expect(table.getByRole('columnheader')).toHaveText(['Name / Username', 'Role', 'Created', 'Action']);
      await expect(table.locator('tbody').getByRole('row')).toHaveCount(3);
    }
    const accountView = username => layout === 'mobile'
      ? cards.getByRole('article', { name: `Account ${username}`, exact: true })
      : table.getByRole('row').filter({ has: page.getByText(`@${username}`, { exact: true }) });
    for (const [account, role, date] of [[editor, 'Admin', 'Feb 03, 2025'], [writer, 'user', 'Feb 04, 2025']]) {
      const view = accountView(account.username);
      await expect(view).toBeVisible();
      await expect(view.getByText(account.displayName, { exact: true })).toBeVisible();
      await expect(view.getByText(`@${account.username}`, { exact: true })).toBeVisible();
      await expect(view.getByText(role, { exact: true })).toBeVisible();
      await expect(view.getByText(date, { exact: true })).toBeVisible();
      await expect(view).not.toContainText(account.password);
    }
    for (const [username, reason] of [
      ['admin', 'Default admin cannot be deleted.'],
      ['seed_editor', 'You cannot delete your own account.'],
    ]) {
      const view = accountView(username);
      await expect(view.getByRole('button', { name: `Delete ${username}`, exact: true })).toBeDisabled();
      await expect(view.getByRole('button', { name: `Delete ${username}`, exact: true })).toHaveAttribute('title', reason);
      await expect(view.getByText(reason, { exact: true })).toBeVisible();
    }
    await expect(accountView('admin').getByText('Permanent account', { exact: true })).toBeVisible();
    expect(await stored(page, 'users')).toEqual([editor, writer]);
    const removeWriter = accountView(writer.username).getByRole('button', { name: 'Delete seed_writer', exact: true });
    await expect(removeWriter).toBeEnabled();
    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toBe('Delete account @seed_writer? Their posts will be retained.');
      await dialog.dismiss();
    });
    await removeWriter.click();
    await expect(accountView(writer.username)).toBeVisible();
    expect(await stored(page, 'users')).toEqual([editor, writer]);
    page.once('dialog', async dialog => dialog.accept());
    await removeWriter.click();
    await expect(page.getByRole('status')).toHaveText('Account @seed_writer deleted. Their posts were retained.');
    await expect(page.getByRole('heading', { name: 'Accounts (2)' })).toBeVisible();
    await expect(accountView(writer.username)).toHaveCount(0);
    await expect(accountView(editor.username)).toBeVisible();
    expect(await stored(page, 'users')).toEqual([editor]);
    await navigate(page, 'Admin Dashboard');
    await counts(page, 0, 2, 2, 0);
    await page.getByRole('navigation', { name: 'Quick actions' }).getByRole('link', { name: 'Manage Users' }).click();
    await expect(accountView(writer.username)).toHaveCount(0);
    await expect(accountView(editor.username).getByRole('button', { name: 'Delete seed_editor' })).toBeDisabled();
    expect(await stored(page, 'users')).toEqual([editor]);
  });
}

for (const path of ['/admin', '/users']) {
  test(`guest initial deep link ${path} fails closed`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    expect(await stored(page, 'users')).toEqual([]);
  });
}
