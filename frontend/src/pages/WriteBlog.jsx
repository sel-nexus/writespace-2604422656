/** Create or edit browser-local plaintext without saving cancelled drafts. */
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import Field from '../components/Field.jsx';
import { sessionType } from '../components/BlogCard.jsx';
import { getSession, validateSession } from '../utils/auth.js';
import { canManage, createPost, getPost, updatePost } from '../utils/posts.js';
import { ui } from '../utils/styles.js';

/** Prefill editable posts and validate required fields through the authorized service.
 * @param {object} props Candidate identity, defaulting to the persisted session.
 * @returns {JSX.Element} Editor, missing state or access redirect.
 */
export default function WriteBlog({ session = getSession() }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const post = id ? getPost(id) : null;
  const [values, setValues] = useState(() => ({ title: post?.title || '', content: post?.content || '' }));
  const [fields, setFields] = useState({});
  const [error, setError] = useState('');
  useEffect(() => {
    const current = id ? getPost(id) : null;
    setValues({ title: current?.title || '', content: current?.content || '' });
    setFields({});
    setError('');
  }, [id]);

  if (!validateSession(session)) return <Navigate to="/login" replace />;
  if (id && post && !canManage(post, session)) return <Navigate to="/blogs" replace />;
  if (id && !post) {
    return (
      <main className={`${ui.page} space-y-6`}>
        <h1 className={ui.heading}>Post not found</h1>
        <Link to="/blogs" className={ui.ghost}>Back to All Posts</Link>
      </main>
    );
  }

  /** Keep plaintext controlled and count every entered character. */
  function change(event) {
    setValues({ ...values, [event.target.name]: event.target.value });
  }

  /** Navigate only after successful persistence; keep failed drafts and inline errors. */
  function submit(event) {
    event.preventDefault();
    setFields({});
    setError('');
    try {
      const saved = id ? updatePost(id, values, session) : createPost(values, session);
      navigate(`/blog/${saved.id}`);
    } catch (failure) {
      setFields(failure.fields || {});
      setError(failure.fields ? '' : failure.message);
    }
  }

  return (
    <main className={`${ui.page} space-y-8`}>
      <h1 className={ui.heading}>{id ? 'Edit Blog' : 'Write a Blog'}</h1>
      <form onSubmit={submit} noValidate className={`${ui.card} space-y-6 md:p-10`}>
        <Field
          id="post-title" label="Title" name="title" value={values.title}
          onChange={change} error={fields.title} required
        />
        <Field
          id="post-content" label="Content" name="content" multiline value={values.content}
          onChange={change} error={fields.content} required
        />
        <p role="status" className="text-right text-sm tabular-nums text-stone-600">{values.content.length} characters</p>
        {error && (
          <p role="alert" className={ui.error}>{error}</p>
        )}
        <div className="flex flex-col gap-3 md:flex-row">
          <button type="submit" className={ui.primary}>Save</button>
          <Link to={id ? `/blog/${id}` : '/blogs'} className={ui.ghost}>Cancel</Link>
        </div>
      </form>
    </main>
  );
}
WriteBlog.propTypes = { session: sessionType };
