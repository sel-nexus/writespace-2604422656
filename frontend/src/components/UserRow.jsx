/** Show account identity in desktop rows or mobile cards without exposing passwords. */
import PropTypes from 'prop-types';
import { Avatar } from './Avatar.jsx';
import { getSession, validateSession } from '../utils/auth.js';
import { formatPostDate } from '../utils/posts.js';
import { ui } from '../utils/styles.js';

/** Render responsive identity and fail-closed deletion controls.
 * @param {object} props Account, candidate session, delete callback and mobile presentation flag.
 * @returns {JSX.Element} Table row or stacked account card.
 */
export function UserRow({ account, session = getSession(), onDelete, mobile = false }) {
  const identity = validateSession(session);
  const reason = account.id === 'admin' ? 'Default admin cannot be deleted.'
    : account.id === identity?.userId ? 'You cannot delete your own account.'
      : identity?.role !== 'admin' ? 'Administrator access is required.' : '';
  const badgeColors = { admin: 'bg-stone-100 text-stone-800', user: 'bg-teal-50 text-teal-800' };
  const badge = (
    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${badgeColors[account.role]}`}>
      {account.role === 'admin' ? 'Admin' : 'user'}
    </span>
  );
  const details = (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar role={account.role} />
      <div className="min-w-0 break-words">
        <p className="font-semibold">{account.displayName}</p>
        <p className="text-sm text-stone-600">@{account.username}</p>
      </div>
    </div>
  );
  const date = account.id === 'admin' ? 'Permanent account' : formatPostDate(account.createdAt);
  const action = (
    <div className="space-y-2">
      <button
        type="button" className={ui.danger} disabled={Boolean(reason)} title={reason || undefined}
        aria-label={`Delete ${account.username}`} onClick={() => { if (!reason) onDelete(account.id); }}
      >
        Delete
      </button>
      {reason && <p className="max-w-56 text-xs text-stone-600">{reason}</p>}
    </div>
  );
  if (mobile) {
    return (
      <article aria-label={`Account ${account.username}`} className={`${ui.card} space-y-4`}>
        {details}
        <div className="flex flex-wrap items-center gap-3">
          {badge}
          <p className="text-sm text-stone-600">{date}</p>
        </div>
        {action}
      </article>
    );
  }
  return (
    <tr className="border-t border-stone-200">
      <td className="p-4">{details}</td>
      <td className="p-4">{badge}</td>
      <td className="p-4 text-sm text-stone-600">{date}</td>
      <td className="p-4">{action}</td>
    </tr>
  );
}

UserRow.propTypes = {
  account: PropTypes.shape({
    id: PropTypes.string.isRequired, displayName: PropTypes.string.isRequired, username: PropTypes.string.isRequired,
    role: PropTypes.oneOf(['admin', 'user']).isRequired, createdAt: PropTypes.string,
  }).isRequired,
  session: PropTypes.shape({ userId: PropTypes.string, username: PropTypes.string, displayName: PropTypes.string, role: PropTypes.string }),
  onDelete: PropTypes.func.isRequired,
  mobile: PropTypes.bool,
};
