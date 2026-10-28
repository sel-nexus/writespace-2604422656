/** Render a labelled control with an associated validation message. */
import PropTypes from 'prop-types';
import { ui } from '../utils/styles';
export default function Field({ id, label, error, multiline = false, ...props }) {
  const Control = multiline ? 'textarea' : 'input';
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block font-semibold">{label}</label>
      <Control
        id={id}
        className={`${ui.input} ${multiline ? 'min-h-64' : ''}`}
        aria-required="true"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error && <p id={`${id}-error`} role="alert" className="text-red-700">{error}</p>}
    </div>
  );
}
Field.propTypes = { id: PropTypes.string.isRequired, label: PropTypes.string.isRequired, error: PropTypes.string, multiline: PropTypes.bool };
