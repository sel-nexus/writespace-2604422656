/** Show all browser-local writing in newest-first order. */
import { Link } from 'react-router-dom';
import { PencilSimple } from '@phosphor-icons/react';
import { BlogCard, sessionType } from '../components/BlogCard.jsx';
import { sortedPosts } from '../utils/posts.js';
import { ui } from '../utils/styles.js';

/** Render the shared reading grid or its first-post invitation.
 * @param {object} props Candidate session for card ownership controls.
 * @returns {JSX.Element} All-blogs workspace.
 */
export default function Home({ session = null }) {
  const posts = sortedPosts();
  return (
    <main className={`${ui.page} space-y-8`}>
      <header className="flex flex-wrap items-center justify-between gap-5">
        <h1 className={ui.heading}>All Blogs</h1>
        <Link to="/write" className={ui.primary}>
          <PencilSimple size={20} aria-hidden="true" />
          Write
        </Link>
      </header>
      {posts.length ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, index) => (
            <BlogCard key={post.id} post={post} index={index} session={session} />
          ))}
        </div>
      ) : (
        <section className={`${ui.card} py-16 text-center`}>
          <p className="font-[Georgia] text-2xl text-stone-700">No blogs yet. Be the first to write one!</p>
        </section>
      )}
    </main>
  );
}
Home.propTypes = { session: sessionType };
