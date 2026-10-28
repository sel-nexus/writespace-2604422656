/** Present a reader link and a separate, ownership-aware edit action. */
import PropTypes from 'prop-types';
import { PencilSimple } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { Avatar } from './Avatar.jsx';
import { getAccounts } from '../utils/auth.js';
import { canManage, formatPostDate } from '../utils/posts.js';
import { ui } from '../utils/styles.js';

export const postType = PropTypes.shape({
  id: PropTypes.string.isRequired, title: PropTypes.string.isRequired, content: PropTypes.string.isRequired,
  createdAt: PropTypes.string.isRequired, authorId: PropTypes.string.isRequired, authorName: PropTypes.string.isRequired,
});
export const sessionType = PropTypes.shape({
  userId: PropTypes.string.isRequired, username: PropTypes.string.isRequired,
  displayName: PropTypes.string.isRequired, role: PropTypes.oneOf(['admin', 'user']).isRequired,
});

/** Show the stored author name with the current account's role avatar.
 * @param {object} props Stored post metadata.
 * @returns {JSX.Element} Author and creation date.
 */
export function PostByline({ post }) {
  const role = getAccounts().find(account => account.id === post.authorId)?.role || 'user';
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-stone-600">
      <Avatar role={role} />
      <span className="break-words">{post.authorName}</span>
      <time dateTime={post.createdAt}>{formatPostDate(post.createdAt)}</time>
    </div>
  );
}
PostByline.propTypes = { post: postType.isRequired };

/** Render a post preview without nesting interactive links.
 * @param {object} props Post, sorted index and candidate session.
 * @returns {JSX.Element} Preview card with eligible edit action.
 */
export function BlogCard({ post, index = 0, session = null }) {
  const accents = ['border-t-teal-600', 'border-t-stone-500', 'border-t-teal-800', 'border-t-stone-300'];
  return (
    <article className={`${ui.card} flex min-w-0 flex-col gap-5 border-t-4 ${accents[index % accents.length]}`}>
      <Link
        to={`/blog/${post.id}`}
        aria-label={`Read ${post.title}`}
        className="block flex-1 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700"
      >
        <h2 className="break-words font-[Georgia] text-2xl leading-tight text-stone-900">{post.title}</h2>
        <p className="mt-3 break-words leading-relaxed text-stone-600">{post.content.slice(0, 120)}</p>
      </Link>
      <PostByline post={post} />
      {canManage(post, session) && (
        <Link to={`/edit/${post.id}`} className={`${ui.secondary} self-start`} aria-label={`Edit ${post.title}`}>
          <PencilSimple size={20} aria-hidden="true" />
          Edit
        </Link>
      )}
    </article>
  );
}
BlogCard.propTypes = { post: postType.isRequired, index: PropTypes.number, session: sessionType };
