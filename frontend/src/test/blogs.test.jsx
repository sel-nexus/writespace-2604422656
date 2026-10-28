/** Verify list, reader and editor behavior using real browser-local services. */
import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import App from '../App.jsx';
import Home from '../pages/Home.jsx';
import ReadBlog from '../pages/ReadBlog.jsx';
import WriteBlog from '../pages/WriteBlog.jsx';
import { BlogCard } from '../components/BlogCard.jsx';
import { register, sessionFor, DEFAULT_ADMIN, login } from '../utils/auth.js';
import { createPost, getPost } from '../utils/posts.js';
import { getPosts, savePosts } from '../utils/storage.js';

let owner;
const admin = sessionFor(DEFAULT_ADMIN);
beforeEach(() => {
  owner = register({ displayName: 'Mira', username: 'mira', password: 'demo', confirmPassword: 'demo' });
});

/** Mount actual post routes so assertions observe navigation and persisted results. */
function workspace(path, session = owner) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/blogs" element={<Home session={session} />} />
        <Route path="/blog/:id" element={<ReadBlog session={session} />} />
        <Route path="/write" element={<WriteBlog session={session} />} />
        <Route path="/edit/:id" element={<WriteBlog session={session} />} />
        <Route path="/login" element={<h1>Login required</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

it('shows the exact empty invitation and Write navigation', async () => {
  workspace('/blogs');
  expect(screen.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
  await userEvent.click(screen.getByRole('link', { name: 'Write' }));
  expect(screen.getByRole('heading', { name: 'Write a Blog' })).toBeVisible();
});

it('renders all sorted cards, exact excerpts, dates, avatars and responsive accent cycling', () => {
  const base = createPost({ title: 'Base', content: 'x'.repeat(130) });
  const posts = Array.from({ length: 5 }, (_, index) => ({
    ...base, id: `p${index}`, title: `Title ${index}`, createdAt: `2026-03-0${index + 1}T12:00:00.000Z`,
  }));
  savePosts(posts);
  workspace('/blogs');
  const cards = screen.getAllByRole('article');
  expect(cards).toHaveLength(5);
  expect(within(cards[0]).getByRole('heading')).toHaveTextContent('Title 4');
  expect(within(cards[4]).getByRole('heading')).toHaveTextContent('Title 0');
  expect(cards[0].parentElement).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3');
  expect(cards[0]).toHaveClass('border-t-teal-600');
  expect(cards[1]).toHaveClass('border-t-stone-500');
  expect(cards[2]).toHaveClass('border-t-teal-800');
  expect(cards[3]).toHaveClass('border-t-stone-300');
  expect(cards[4]).toHaveClass('border-t-teal-600');
  expect(within(cards[0]).getByText('x'.repeat(120))).toBeVisible();
  expect(within(cards[0]).getByText('Mar 05, 2026')).toBeVisible();
  expect(within(cards[0]).getByText('Mira')).toBeVisible();
  expect(cards[0].querySelector('svg')).not.toBeNull();
});

it.each(['owner', 'admin', 'nonowner', 'guest'])('card read/edit links are separate and ownership-aware for %s', role => {
  const post = createPost({ title: 'Story', content: 'Content' });
  const session = role === 'owner' ? owner : role === 'admin' ? admin : role === 'guest' ? null
    : register({ displayName: 'Other', username: 'other', password: 'demo', confirmPassword: 'demo' });
  render(
    <MemoryRouter>
      <BlogCard post={post} session={session} />
    </MemoryRouter>,
  );
  const read = screen.getByRole('link', { name: 'Read Story' });
  expect(read).toHaveAttribute('href', `/blog/${post.id}`);
  const edit = screen.queryByRole('link', { name: 'Edit Story' });
  if (['owner', 'admin'].includes(role)) {
    expect(edit).toHaveAttribute('href', `/edit/${post.id}`);
    expect(read.contains(edit)).toBe(false);
  } else expect(edit).not.toBeInTheDocument();
});

it('reads the full title and multiline XSS text without creating executable HTML', async () => {
  const title = 'A full title '.repeat(20);
  const content = 'Line one\n\n<script>alert(1)</script>\n<img src=x onerror=alert(1)>';
  const post = createPost({ title, content });
  const { container } = workspace(`/blog/${post.id}`);
  expect(screen.getByRole('heading', { name: title.trim() })).toBeVisible();
  const text = container.querySelector('.whitespace-pre-wrap');
  expect(text.textContent).toBe(content);
  expect(text.querySelector('script, img')).toBeNull();
  await userEvent.click(screen.getByRole('link', { name: 'Back to All Posts' }));
  expect(screen.getByRole('heading', { name: 'All Blogs' })).toBeVisible();
});

it.each(['/blog/missing', '/edit/missing'])('renders missing post and working back link at %s', async path => {
  workspace(path);
  expect(screen.getByRole('heading', { name: 'Post not found' })).toBeVisible();
  await userEvent.click(screen.getByRole('link', { name: 'Back to All Posts' }));
  expect(screen.getByRole('heading', { name: 'All Blogs' })).toBeVisible();
});

it('nonowners read without maintenance controls and unauthorized editor redirects to blogs', () => {
  const post = createPost({ title: 'Owned', content: 'Content' });
  const other = register({ displayName: 'Other', username: 'other', password: 'demo', confirmPassword: 'demo' });
  const view = workspace(`/blog/${post.id}`, other);
  expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
  view.unmount();
  workspace(`/edit/${post.id}`, other);
  expect(screen.getByRole('heading', { name: 'All Blogs' })).toBeVisible();
  expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
  expect(getPost(post.id)).toEqual(post);
});

it('validates required fields inline, counts content and saves then reads the created post', async () => {
  workspace('/write');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByText('Title is required.')).toBeVisible();
  expect(screen.getByText('Content is required.')).toBeVisible();
  expect(screen.getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByLabelText('Content')).toHaveClass('min-h-64');
  expect(getPosts()).toEqual([]);
  await userEvent.type(screen.getByLabelText('Title'), 'New post');
  fireEvent.change(screen.getByLabelText('Content'), { target: { value: 'First\nSecond' } });
  expect(screen.getByRole('status')).toHaveTextContent('12 characters');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByRole('heading', { name: 'New post' })).toBeVisible();
  expect(getPosts()[0]).toMatchObject({ title: 'New post', content: 'First\nSecond', authorId: owner.userId });
});

it('creates and edits large title/content values with full reader text, card excerpts and editor prefills', async () => {
  const title = 'Long title segment '.repeat(300).trim();
  const content = 'Large plaintext paragraph\n\n<script>not HTML</script>\n'.repeat(2000);
  const { container } = workspace('/write');
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: title } });
  fireEvent.change(screen.getByLabelText('Content'), { target: { value: content } });
  expect(screen.getByLabelText('Title')).toHaveValue(title);
  expect(screen.getByLabelText('Content')).toHaveValue(content);
  expect(screen.getByRole('status')).toHaveTextContent(`${content.length} characters`);
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  const [post] = getPosts();
  expect(post).toMatchObject({ title, content, authorId: owner.userId });
  expect(screen.getByRole('heading', { name: title, exact: true })).toBeVisible();
  expect(screen.getByRole('heading', { name: title, exact: true }).textContent).toBe(title);
  expect(container.querySelector('article .whitespace-pre-wrap')).toBeVisible();
  expect(container.querySelector('article .whitespace-pre-wrap').textContent).toBe(content);
  expect(container.querySelector('article script')).toBeNull();
  await userEvent.click(screen.getByRole('link', { name: 'Back to All Posts' }));
  const card = screen.getByRole('article');
  expect(within(card).getByRole('heading').textContent).toBe(title);
  expect(card.querySelector('p').textContent).toBe(content.slice(0, 120));
  await userEvent.click(screen.getByRole('link', { name: `Edit ${title}`, exact: true }));
  expect(screen.getByLabelText('Title')).toHaveValue(title);
  expect(screen.getByLabelText('Content')).toHaveValue(content);

  const nextTitle = 'Revised long title '.repeat(400).trim();
  const nextContent = 'Revised plaintext\n\nLast line with trailing space \n'.repeat(2500);
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: nextTitle } });
  fireEvent.change(screen.getByLabelText('Content'), { target: { value: nextContent } });
  expect(screen.getByRole('status')).toHaveTextContent(`${nextContent.length} characters`);
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(getPost(post.id)).toEqual({ ...post, title: nextTitle, content: nextContent });
  expect(getPosts()).toEqual([{ ...post, title: nextTitle, content: nextContent }]);
  expect(screen.getByRole('heading', { name: nextTitle, exact: true })).toBeVisible();
  expect(screen.getByRole('heading', { name: nextTitle, exact: true }).textContent).toBe(nextTitle);
  expect(container.querySelector('article .whitespace-pre-wrap')).toBeVisible();
  expect(container.querySelector('article .whitespace-pre-wrap').textContent).toBe(nextContent);
  await userEvent.click(screen.getByRole('link', { name: 'Edit', exact: true }));
  expect(screen.getByLabelText('Title')).toHaveValue(nextTitle);
  expect(screen.getByLabelText('Content')).toHaveValue(nextContent);
});

it.each(['owner', 'admin'])('prefills and saves updates as %s while retaining original metadata', async role => {
  const post = createPost({ title: 'Old title', content: 'Old\ncontent' });
  workspace(`/edit/${post.id}`, role === 'admin' ? admin : owner);
  expect(screen.getByLabelText('Title')).toHaveValue(post.title);
  expect(screen.getByLabelText('Content')).toHaveValue(post.content);
  await userEvent.clear(screen.getByLabelText('Title'));
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByText('Title is required.')).toBeVisible();
  expect(getPost(post.id)).toEqual(post);
  await userEvent.type(screen.getByLabelText('Title'), 'Updated');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByRole('heading', { name: 'Updated' })).toBeVisible();
  expect(getPost(post.id)).toEqual({ ...post, title: 'Updated' });
});

it.each(['create', 'edit'])('Cancel leaves %s draft unsaved and navigates via link', async mode => {
  const post = createPost({ title: 'Original', content: 'Original content' });
  workspace(mode === 'edit' ? `/edit/${post.id}` : '/write');
  await userEvent.type(screen.getByLabelText('Title'), ' unsaved');
  await userEvent.click(screen.getByRole('link', { name: 'Cancel' }));
  expect(screen.getByRole('heading', { name: mode === 'edit' ? 'Original' : 'All Blogs' })).toBeVisible();
  expect(getPosts()).toEqual([post]);
});

it.each([true, false])('native delete confirmation %s controls removal and navigation', async accepted => {
  const post = createPost({ title: 'Delete me', content: 'Content' });
  vi.spyOn(window, 'confirm').mockReturnValue(accepted);
  workspace(`/blog/${post.id}`);
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(getPosts()).toEqual(accepted ? [] : [post]);
  expect(screen.getByRole('heading', { name: accepted ? 'All Blogs' : 'Delete me' })).toBeVisible();
});

it('admin can delete another writer post through the reader', async () => {
  const post = createPost({ title: 'Owned', content: 'Content' });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  workspace(`/blog/${post.id}`, admin);
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(getPosts()).toEqual([]);
  expect(screen.getByRole('heading', { name: 'All Blogs' })).toBeVisible();
});

it.each(['create', 'edit', 'delete'])('shows %s storage failures and preserves the existing post', async operation => {
  const post = createPost({ title: 'Keep', content: 'Content' });
  workspace(operation === 'create' ? '/write' : operation === 'edit' ? `/edit/${post.id}` : `/blog/${post.id}`);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
  if (operation === 'delete') {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
  } else {
    await userEvent.type(screen.getByLabelText('Title'), 'New');
    await userEvent.type(screen.getByLabelText('Content'), 'New content');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByLabelText('Title').value).toContain('New');
  }
  expect(screen.getByRole('alert')).toHaveTextContent(/storage is unavailable or full/);
  expect(getPosts()).toEqual([post]);
});

it.each(['/blogs', '/blog/missing', '/write', '/edit/missing'])('App guards guest deep link %s', path => {
  localStorage.removeItem('writespace_session');
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
  expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

it('editor itself redirects invalid identity rather than exposing a form', () => {
  workspace('/write', null);
  expect(screen.getByRole('heading', { name: 'Login required' })).toBeVisible();
  expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
});

it('App wires authenticated list, creation, reading and edit routes through navigation', async () => {
  login('mira', 'demo');
  render(
    <MemoryRouter initialEntries={['/blogs']}>
      <App />
    </MemoryRouter>,
  );
  await userEvent.click(within(screen.getByRole('navigation', { name: 'Workspace navigation' })).getByRole('link', { name: 'Write' }));
  await userEvent.type(screen.getByLabelText('Title'), 'Wired');
  await userEvent.type(screen.getByLabelText('Content'), 'Real content');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByRole('heading', { name: 'Wired' })).toBeVisible();
  await userEvent.click(screen.getByRole('link', { name: 'Edit' }));
  expect(screen.getByRole('heading', { name: 'Edit Blog' })).toBeVisible();
  expect(screen.getByLabelText('Title')).toHaveValue('Wired');
});
