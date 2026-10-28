/** Share static Phosphor role avatars across navigation and later author/account views. */
import PropTypes from 'prop-types';
import { BookOpen, Crown } from '@phosphor-icons/react';

/** Render a circular role avatar without uploads or emoji.
 * @param {object} props Lowercase role and optional size.
 * @returns {JSX.Element} Decorative SVG inside a role-colored circle.
 */
export function Avatar({ role = 'user', size = 20 }) {
  const Icon = role === 'admin' ? Crown : BookOpen;
  const colors = { admin: 'bg-stone-800 text-amber-100', user: 'bg-teal-100 text-teal-800' };
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full p-2 ${colors[role] || colors.user}`}>
      <Icon size={size} weight="bold" aria-hidden="true" />
    </span>
  );
}

Avatar.propTypes = {
  role: PropTypes.oneOf(['admin', 'user']),
  size: PropTypes.number,
};

/** Return reusable role-avatar JSX.
 * @param {string} role Lowercase account role.
 * @returns {JSX.Element} Static role avatar.
 */
export function getAvatar(role) {
  return <Avatar role={role} />;
}
