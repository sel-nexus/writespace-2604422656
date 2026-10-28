/** Read full escaped plaintext and offer author/admin maintenance controls. */
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PencilSimple, ArrowLeft } from '@phosphor-icons/react';
import { PostByline, sessionType } from '../components/BlogCard.jsx';
import { canManage, deletePost, getPost } from '../utils/posts.js';
import { ui } from '../utils/styles.js';

/** Render a full post, or a graceful missing-record state.
 * @param {object} props Candidate identity for maintenance controls.
 * @returns {JSX.Element} Plaintext reader.
 */
export default function ReadBlog({ session = null }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const post = getPost(id);

  /** Preserve the post on dismissal or failed persistence; navigate only after deletion. */
  function remove() {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    try {
      deletePost(id, session);
      navigate('/blogs');
    } catch (failure) {
      setError(failure.message);
    }
  }

  return (
    <main className={`${ui.page} space-y-8`}>
      <Link to="/blogs" className={`${ui.ghost} gap-2 px-0`}>
        <ArrowLeft size={20} aria-hidden="true" />
        Back to All Posts
      </Link>
      {post ? (
        <article className={`${ui.card} space-y-8 md:p-10`}>
          <header className="space-y-5">
            <h1 className={`${ui.heading} break-words leading-tight`}>{post.title}</h1>
            <PostByline post={post} />
          </header>
          <div className="whitespace-pre-wrap break-words text-lg leading-relaxed text-stone-800">{post.content}</div>
          {canManage(post, session) && (
            <div className="flex flex-wrap gap-3 border-t border-stone-200 pt-6">
              <Link to={`/edit/${id}`} className={ui.secondary}>
                <PencilSimple size={20} aria-hidden="true" />
                Edit
              </Link>
              <button type="button" onClick={remove} className={ui.danger}>Delete</button>
            </div>
          )}
          {error && (
            <p role="alert" className={ui.error}>{error}</p>
          )}
        </article>
      ) : (
        <h1 className={ui.heading}>Post not found</h1>
      )}
    </main>
  );
}
ReadBlog.propTypes = { session: sessionType };
