/** Verify public discovery against real browser-local storage and observable navigation. */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PublicNavbar } from '../components/PublicNavbar.jsx';
import LandingPage from '../pages/LandingPage.jsx';
import App from '../App.jsx';

/** Build a complete stored post while permitting deliberate invalid-field overrides.
 * Args:
 *   overrides: Fields that distinguish a scenario's record.
 * Returns:
 *   A browser-local post fixture.
 */
function makePost(overrides = {}) {
  return {
    id: 'post-one', title: 'A fresh page', content: 'A small thought worth keeping.',
    createdAt: '2026-03-04T12:00:00.000Z', authorId: 'writer-one', authorName: 'Mira',
    ...overrides,
  };
}

/** Render both public components with destination markers instead of future feature pages.
 * Args:
 *   session: Account supplied directly to the public components.
 * Returns:
 *   Testing Library's rendered view.
 */
function renderPublic(session = null) {
  return render(
    <MemoryRouter>
      <Routes>
        <Route
          path="/"
          element={
            <>
              <PublicNavbar session={session} />
              <LandingPage session={session} />
            </>
          }
        />
        <Route
          path="/login"
          element={
            <h1>Login destination</h1>
          }
        />
        <Route
          path="/register"
          element={
            <h1>Register destination</h1>
          }
        />
        <Route
          path="/blogs"
          element={
            <h1>Writer destination</h1>
          }
        />
        <Route
          path="/admin"
          element={
            <h1>Admin destination</h1>
          }
        />
        <Route
          path="/blog/:id"
          element={
            <h1>Preview destination</h1>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('public discovery', () => {
  it('introduces the product, features, empty state, and footer navigation', () => {
    renderPublic();
    expect(screen.getByRole('heading', { level: 1, name: 'WriteSpace' })).toBeInTheDocument();
    expect(screen.getByText('Your thoughts. Your space. Beautifully simple.')).toBeInTheDocument();
    for (const name of ['Write Freely', 'Private & Local', 'Instant & Fast', 'Latest from the Blog']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    }
    expect(screen.getByText('No posts yet — check back soon!')).toBeInTheDocument();
    const footer = within(screen.getByRole('navigation', { name: 'Footer navigation' }));
    expect(footer.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(footer.getByRole('link', { name: 'All Blogs' })).toHaveAttribute('href', '/blogs');
    expect(footer.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
    expect(footer.getByRole('link', { name: 'Register' })).toHaveAttribute('href', '/register');
    expect(screen.getByText(`© ${new Date().getFullYear()} WriteSpace`)).toBeInTheDocument();
  });

  it('shows the newest three valid records, not the first three stored records', () => {
    const records = [
      makePost({ id: 'old', title: 'Oldest', createdAt: '2026-01-01T00:00:00Z' }),
      makePost({ id: 'middle', title: 'Middle', createdAt: '2026-03-01T00:00:00Z' }),
      makePost({ id: 'bad', title: 'Invalid date', createdAt: 'not-a-date' }),
      makePost({ id: 'new', title: 'Newest', createdAt: '2026-03-05T00:00:00Z' }),
      makePost({ id: 'next', title: 'Next newest', createdAt: '2026-03-04T00:00:00Z' }),
    ];
    localStorage.setItem('writespace_posts', JSON.stringify(records));
    renderPublic();
    const latest = within(screen.getByRole('region', { name: 'Latest from the Blog' }));
    expect(latest.getAllByRole('heading', { level: 3 }).map(heading => heading.textContent))
      .toEqual(['Newest', 'Next newest', 'Middle']);
    expect(latest.queryByText('Oldest')).not.toBeInTheDocument();
    expect(latest.queryByText('Invalid date')).not.toBeInTheDocument();
    expect(latest.getByText('Mar 05, 2026')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('writespace_posts'))).toEqual(records);
  });

  it('renders short excerpts as plain text and truncates long content at 120 characters', () => {
    const short = '<script>not executable</script>';
    localStorage.setItem('writespace_posts', JSON.stringify([
      makePost({ content: short }),
      makePost({ id: 'long', title: 'Long writing', content: 'x'.repeat(121) }),
    ]));
    renderPublic();
    expect(screen.getByText(short)).toBeInTheDocument();
    expect(screen.getByText(`${'x'.repeat(120)}…`)).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
  });

  it.each(['{invalid json', '{}', 'null', '[]'])('uses the empty state for unusable storage: %s', value => {
    localStorage.setItem('writespace_posts', value);
    renderPublic();
    expect(screen.getByText('No posts yet — check back soon!')).toBeInTheDocument();
  });

  it('rejects missing, blank, and non-string post fields without crashing', () => {
    localStorage.setItem('writespace_posts', JSON.stringify([
      null, [], makePost({ id: '' }), makePost({ title: {} }), makePost({ content: ' ' }),
      makePost({ createdAt: null }), makePost({ authorId: '' }), makePost({ authorName: 4 }),
    ]));
    renderPublic();
    expect(screen.getByText('No posts yet — check back soon!')).toBeInTheDocument();
  });

  it('uses the empty state when browser storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage blocked');
    });
    renderPublic();
    expect(screen.getByText('No posts yet — check back soon!')).toBeInTheDocument();
  });

  it.each([
    ['Start Reading', 'Login destination'],
    ['Get Started Free', 'Register destination'],
    ['Get Started', 'Register destination'],
  ])('navigates guests through %s', async (label, destination) => {
    const user = userEvent.setup();
    renderPublic();
    await user.click(screen.getByRole('link', { name: label, exact: true }));
    expect(screen.getByRole('heading', { name: destination })).toBeInTheDocument();
  });

  it('navigates the public Login action and exposes an accessible mobile toggle', async () => {
    const user = userEvent.setup();
    renderPublic();
    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('button', { name: 'Close navigation' }));
    expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
    const nav = within(screen.getByRole('navigation', { name: 'Public navigation' }));
    await user.click(nav.getByRole('link', { name: 'Login' }));
    expect(screen.getByRole('heading', { name: 'Login destination' })).toBeInTheDocument();
  });

  it.each([
    ['admin', '/admin', 'Admin destination'],
    ['user', '/blogs', 'Writer destination'],
  ])('returns a signed-in %s to the role home without registration CTAs', async (role, home, destination) => {
    const user = userEvent.setup();
    renderPublic({ role, displayName: 'Mira' });
    const nav = within(screen.getByRole('navigation', { name: 'Public navigation' }));
    expect(nav.getByText('Mira')).toBeInTheDocument();
    expect(nav.queryByRole('link', { name: 'Login' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Get Started Free' })).not.toBeInTheDocument();
    for (const link of screen.getAllByRole('link', { name: 'Go to Dashboard' })) {
      expect(link).toHaveAttribute('href', home);
    }
    await user.click(screen.getByRole('link', { name: 'Start Reading' }));
    expect(screen.getByRole('heading', { name: destination })).toBeInTheDocument();
  });

  it.each([
    ['admin', 'Admin destination'],
    ['user', 'Writer destination'],
  ])('navigates the public dashboard action for %s', async (role, destination) => {
    const user = userEvent.setup();
    renderPublic({ role, displayName: 'Mira' });
    const nav = within(screen.getByRole('navigation', { name: 'Public navigation' }));
    await user.click(nav.getByRole('link', { name: 'Go to Dashboard' }));
    expect(screen.getByRole('heading', { name: destination })).toBeInTheDocument();
  });

  it('links a guest preview to its protected post URL rather than bypassing the future guard', async () => {
    const user = userEvent.setup();
    localStorage.setItem('writespace_posts', JSON.stringify([makePost()]));
    renderPublic();
    const preview = screen.getByRole('link', { name: 'A fresh page' });
    expect(preview).toHaveAttribute('href', '/blog/post-one');
    await user.click(preview);
    expect(screen.getByRole('heading', { name: 'Preview destination' })).toBeInTheDocument();
  });

  it('renders the initial App root and redirects an unknown route home', async () => {
    render(
      <MemoryRouter initialEntries={['/unknown']}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'WriteSpace' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Public navigation' })).toBeInTheDocument();
  });
});
