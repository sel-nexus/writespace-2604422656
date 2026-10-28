/** Review real browser-local totals and manage the newest five posts. */
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Article, Crown, PencilSimple, Users, BookOpen } from '@phosphor-icons/react';
import { StatCard } from '../components/StatCard.jsx';
import { sessionType } from '../components/BlogCard.jsx';
import { getSession, validateSession } from '../utils/auth.js';
import { deletePost, formatPostDate, sortedPosts } from '../utils/posts.js';
import { getStats } from '../utils/users.js';
import { ui } from '../utils/styles.js';

/** Guard standalone rendering and refresh persisted counts after confirmed deletion.
 * @param {object} props Candidate identity, defaulting to the persisted session.
 * @returns {JSX.Element} Dashboard or guest/non-admin redirect.
 */
export default function AdminDashboard({ session = getSession() }) {
  const [, refresh] = useState(0);
  const [error, setError] = useState('');
  const identity = validateSession(session);
  if (!identity) return <Navigate to="/login" replace />;
  if (identity.role !== 'admin') return <Navigate to="/blogs" replace />;
  const stats = getStats(identity);
  const recent = sortedPosts().slice(0, 5);

  /** Preserve posts on dismissal or failed writes and surface the failure. */
  function remove(post) {
    setError('');
    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    try {
      deletePost(post.id, identity);
      refresh(value => value + 1);
    } catch (failure) {
      setError(failure.message);
    }
  }

  return (
    <main className={`${ui.page} space-y-8`}>
      <header className="space-y-3 rounded-2xl border border-teal-200 bg-teal-50 p-6 md:p-10">
        <p className="text-sm font-semibold uppercase tracking-widest text-teal-800">Your local workspace</p>
        <h1 className={ui.heading}>Admin Dashboard</h1>
        <p className="max-w-xl text-stone-600">A clear view of your writing, accounts, and recent activity.</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Posts" value={stats.posts} icon={Article} />
        <StatCard label="Total Accounts" value={stats.accounts} icon={Users} />
        <StatCard label="Total Admins" value={stats.admins} icon={Crown} />
        <StatCard label="Total Writers" value={stats.writers} icon={BookOpen} />
      </div>
      <nav aria-label="Quick actions" className="flex flex-col gap-3 sm:flex-row">
        <Link to="/write" className={ui.primary}>
          <PencilSimple size={20} aria-hidden="true" />
          Write New Post
        </Link>
        <Link to="/users" className={ui.secondary}>
          <Users size={20} aria-hidden="true" />
          Manage Users
        </Link>
      </nav>
      <section aria-labelledby="recent-posts-heading" className={`${ui.card} space-y-6`}>
        <h2 id="recent-posts-heading" className="font-[Georgia] text-2xl">Recent Posts</h2>
        {error && <p role="alert" className={ui.error}>{error}</p>}
        {recent.length === 0 ? (
          <p className="text-stone-600">No posts yet. Write your first post to begin.</p>
        ) : (
          <ul className="divide-y divide-stone-200">
            {recent.map(post => (
              <li key={post.id} className="flex flex-col justify-between gap-4 py-5 sm:flex-row sm:items-center">
                <div className="min-w-0 space-y-2">
                  <Link to={`/blog/${post.id}`} className="break-words font-semibold text-teal-800 hover:underline">
                    {post.title}
                  </Link>
                  <p className="text-sm text-stone-600">{post.authorName} · {formatPostDate(post.createdAt)}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-3">
                  <Link to={`/edit/${post.id}`} className={ui.secondary} aria-label={`Edit ${post.title}`}>Edit</Link>
                  <button type="button" className={ui.danger} aria-label={`Delete ${post.title}`} onClick={() => remove(post)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

AdminDashboard.propTypes = { session: sessionType };
