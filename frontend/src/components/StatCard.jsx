/** Present a computed workspace total without decorative or invented analytics. */
import PropTypes from 'prop-types';
import { ui } from '../utils/styles.js';

/** Render a labelled count with an optional decorative Phosphor icon.
 * @param {object} props Metric label, numeric value and optional icon.
 * @returns {JSX.Element} Accessible statistic region.
 */
export function StatCard({ label, value, icon: Icon }) {
  return (
    <section aria-label={label} className={`${ui.card} space-y-4`}>
      <div className="flex items-center justify-between gap-3 text-stone-600">
        <h2 className="text-sm font-semibold">{label}</h2>
        {Icon && <Icon size={24} aria-hidden="true" className="text-teal-700" />}
      </div>
      <p className="text-4xl font-semibold tabular-nums text-stone-900">{value}</p>
    </section>
  );
}

StatCard.propTypes = { label: PropTypes.string.isRequired, value: PropTypes.number.isRequired, icon: PropTypes.elementType };
