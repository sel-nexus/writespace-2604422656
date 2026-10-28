/** Introduce the browser-local writing demo and preview its newest valid posts. */
import PropTypes from 'prop-types';
import { ArrowRight, BookOpen, Lightning, PencilLine, ShieldCheck } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { getPosts } from '../utils/storage.js';
import { ui } from '../utils/styles.js';

const features = [
  { title: 'Write Freely', summary: 'Plain-text writing without distractions.', icon: PencilLine, tone: 'bg-teal-50' },
  { title: 'Private & Local', summary: 'Your data lives in this browser, not on a server.', icon: ShieldCheck, tone: 'bg-stone-100' },
  { title: 'Instant & Fast', summary: 'No server, no lag. Open your space and start writing.', icon: Lightning, tone: 'bg-white' },
];

/** Reject malformed records before rendering or sorting browser-local content.
 * Args:
 *   post: Untrusted stored record.
 * Returns:
 *   Whether the record has the required text fields and a readable creation date.
 */
function isValidPost(post) {
  return post && !Array.isArray(post)
    && ['id', 'title', 'content', 'createdAt', 'authorId', 'authorName'].every(
      field => typeof post[field] === 'string' && post[field].trim().length > 0,
    )
    && Number.isFinite(Date.parse(post.createdAt));
}

/** Render public discovery with links that defer protected access to the router.
 * Args:
 *   session: Validated account supplied by the route owner, or null for a guest.
 * Returns:
 *   Hero, feature summaries, up to three recent previews, and public footer.
 */
export default function LandingPage({ session = null }) {
  const posts = getPosts()
    .filter(isValidPost)
    .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt))
    .slice(0, 3);
  const dashboard = session?.role === 'admin' ? '/admin' : '/blogs';

  return (
    <>
      <main id="main-content">
        <section aria-labelledby="landing-title" className="flex min-h-[calc(100dvh-72px)] items-center">
          <div className={`${ui.page} w-full py-16 md:py-24`}>
            <p className="mb-6 text-sm font-semibold uppercase tracking-widest text-teal-800">A browser-local writing space</p>
            <h1
              id="landing-title"
              className="max-w-4xl font-[Georgia] text-[clamp(2.75rem,8vw,6rem)] font-bold leading-tight tracking-tight"
            >
              WriteSpace
            </h1>
            <p className="mt-6 max-w-2xl font-[Georgia] text-3xl leading-snug text-stone-700 md:text-4xl">
              Your thoughts. Your space. Beautifully simple.
            </p>
            <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row">
              <Link to={session ? '/blogs' : '/login'} className={ui.primary}>
                Start Reading
                <ArrowRight size={20} aria-hidden="true" />
              </Link>
              {session ? (
                <Link to={dashboard} className={ui.secondary}>
                  Go to Dashboard
                </Link>
              ) : (
                <Link to="/register" className={ui.secondary}>
                  Get Started Free
                </Link>
              )}
            </div>
            {/* Built-in pulse is the CSS-only hint; reduced-motion visitors get a static card. */}
            <article
              aria-labelledby="writing-hint-title"
              className={`${ui.card} mt-12 max-w-md motion-safe:animate-pulse motion-safe:[animation-duration:6s] motion-reduce:animate-none`}
            >
              <PencilLine size={24} className="mb-4 text-teal-800" aria-hidden="true" />
              <h2 id="writing-hint-title" className="font-[Georgia] text-2xl text-stone-900">
                Make room for your next thought
              </h2>
              <p className="mt-3 leading-relaxed text-stone-600">
                Write a plain-text post and keep it in this browser. Start with a title and a thought worth keeping.
              </p>
              <Link to={session ? '/write' : '/register'} className={`${ui.secondary} mt-5`}>
                Open your writing space
              </Link>
            </article>
          </div>
        </section>
        <section aria-label="WriteSpace features" className={`${ui.page} grid grid-cols-1 gap-5 md:grid-cols-3`}>
          {features.map(({ title, summary, icon: Icon, tone }) => (
            <article key={title} className={`${ui.card.replace('bg-white', tone)}`}>
              <Icon size={24} weight="bold" className="mb-6 text-teal-800" aria-hidden="true" />
              <h2 className="font-[Georgia] text-2xl font-bold text-stone-900">{title}</h2>
              <p className="mt-3 leading-relaxed text-stone-600">{summary}</p>
            </article>
          ))}
        </section>
        <section aria-labelledby="latest-title" className={`${ui.page} pb-24`}>
          <h2 id="latest-title" className={ui.heading}>Latest from the Blog</h2>
          {posts.length ? (
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {posts.map(post => (
                <article key={post.id} className={`${ui.card} flex min-w-0 flex-col`}>
                  <time dateTime={post.createdAt} className="text-sm text-stone-600">
                    {new Date(post.createdAt).toLocaleDateString('en-US', {
                      month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC',
                    })}
                  </time>
                  <h3 className="mt-4 break-words font-[Georgia] text-2xl font-bold">
                    <Link to={`/blog/${encodeURIComponent(post.id)}`} className="rounded text-teal-800 hover:underline focus-visible:outline">
                      {post.title}
                    </Link>
                  </h3>
                  <p className="mt-4 break-words leading-relaxed text-stone-600">
                    {post.content.slice(0, 120)}{post.content.length > 120 ? '…' : ''}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-8 flex items-center gap-4 rounded-2xl bg-stone-100 p-6 text-stone-600">
              <BookOpen size={24} aria-hidden="true" />
              <p>No posts yet — check back soon!</p>
            </div>
          )}
        </section>
      </main>
      <footer className="bg-slate-900 text-slate-100">
        <div className={`${ui.page} flex flex-col gap-6 md:flex-row md:items-center md:justify-between`}>
          <p>© {new Date().getFullYear()} WriteSpace</p>
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-6">
            <Link to="/" className="py-2 hover:underline focus-visible:outline">Home</Link>
            <Link to="/blogs" className="py-2 hover:underline focus-visible:outline">All Blogs</Link>
            <Link to="/login" className="py-2 hover:underline focus-visible:outline">Login</Link>
            <Link to="/register" className="py-2 hover:underline focus-visible:outline">Register</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}

LandingPage.propTypes = {
  session: PropTypes.shape({
    displayName: PropTypes.string.isRequired,
    role: PropTypes.oneOf(['admin', 'user']).isRequired,
  }),
};
