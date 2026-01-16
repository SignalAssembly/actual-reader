/**
 * ImportModal Component (Solid)
 */

import { createSignal, type JSX } from 'solid-js';
import { Spinner } from './Spinner';

export interface ImportModalProps {
  onClose: () => void;
  onJustImport: () => void;
  onProcessNow: () => void;
  onDontShowAgain: (dontShow: boolean) => void;
  importing?: boolean;
}

const styles = {
  overlay: {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    bottom: '0',
    'background-color': 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'center',
    'z-index': '1000',
  } as JSX.CSSProperties,
  modal: {
    'background-color': 'var(--bg-primary)',
    'border-radius': '16px',
    padding: '24px',
    'max-width': '480px',
    width: '90%',
    'box-shadow': '0 20px 40px rgba(0, 0, 0, 0.2)',
  } as JSX.CSSProperties,
  header: {
    display: 'flex',
    'align-items': 'flex-start',
    gap: '16px',
    'margin-bottom': '20px',
  } as JSX.CSSProperties,
  icon: {
    'font-size': '32px',
    'flex-shrink': '0',
  } as JSX.CSSProperties,
  title: {
    'font-size': '20px',
    'font-weight': '600',
    color: 'var(--text-primary)',
    margin: '0 0 8px 0',
  } as JSX.CSSProperties,
  subtitle: {
    'font-size': '14px',
    color: 'var(--text-secondary)',
    margin: '0',
    'line-height': '1.5',
  } as JSX.CSSProperties,
  options: {
    display: 'flex',
    'flex-direction': 'column',
    gap: '12px',
    'margin-bottom': '20px',
  } as JSX.CSSProperties,
  optionCard: {
    display: 'flex',
    'align-items': 'flex-start',
    gap: '12px',
    padding: '16px',
    'background-color': 'var(--bg-secondary)',
    'border-radius': '12px',
    border: '2px solid transparent',
    cursor: 'pointer',
    transition: 'border-color 0.2s, background-color 0.2s',
  } as JSX.CSSProperties,
  optionIcon: {
    'font-size': '24px',
    'flex-shrink': '0',
  } as JSX.CSSProperties,
  optionContent: {
    flex: '1',
  } as JSX.CSSProperties,
  optionTitle: {
    'font-size': '15px',
    'font-weight': '600',
    color: 'var(--text-primary)',
    margin: '0 0 4px 0',
  } as JSX.CSSProperties,
  optionDescription: {
    'font-size': '13px',
    color: 'var(--text-secondary)',
    margin: '0',
    'line-height': '1.4',
  } as JSX.CSSProperties,
  checkbox: {
    display: 'flex',
    'align-items': 'center',
    gap: '8px',
    'margin-bottom': '24px',
  } as JSX.CSSProperties,
  checkboxInput: {
    width: '16px',
    height: '16px',
    cursor: 'pointer',
  } as JSX.CSSProperties,
  checkboxLabel: {
    'font-size': '13px',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  } as JSX.CSSProperties,
  actions: {
    display: 'flex',
    gap: '12px',
    'justify-content': 'flex-end',
  } as JSX.CSSProperties,
  cancelButton: {
    padding: '10px 20px',
    'font-size': '14px',
    'font-weight': '500',
    'background-color': 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-color)',
    'border-radius': '8px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  } as JSX.CSSProperties,
  confirmButton: {
    padding: '10px 24px',
    'font-size': '14px',
    'font-weight': '500',
    'background-color': 'var(--text-accent)',
    color: '#ffffff',
    border: 'none',
    'border-radius': '8px',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  } as JSX.CSSProperties,
  buttonContent: {
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'center',
    gap: '8px',
  } as JSX.CSSProperties,
};

export function ImportModal(props: ImportModalProps) {
  const [dontShowAgain, setDontShowAgain] = createSignal(true);
  const [selectedOption, setSelectedOption] = createSignal<'import' | 'process'>('import');

  const importing = () => props.importing ?? false;

  const handleCheckboxChange = (checked: boolean) => {
    setDontShowAgain(checked);
    props.onDontShowAgain(checked);
  };

  const handleConfirm = () => {
    if (selectedOption() === 'process') {
      props.onProcessNow();
    } else {
      props.onJustImport();
    }
  };

  return (
    <div
      style={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div style={styles.modal}>
        <div style={styles.header}>
          <div style={styles.icon}>{'\u{1F4DA}'}</div>
          <div>
            <h2 style={styles.title}>Import Book</h2>
            <p style={styles.subtitle}>
              You can generate narration now or import the book for reading first.
              Narration can always be generated later.
            </p>
          </div>
        </div>

        <div style={styles.options}>
          <div
            style={{
              ...styles.optionCard,
              ...(selectedOption() === 'import'
                ? { 'border-color': 'var(--text-accent)', 'background-color': 'var(--bg-accent)' }
                : {}),
            }}
            onClick={() => setSelectedOption('import')}
            role="button"
            tabIndex={0}
          >
            <div style={styles.optionIcon}>{'\u{1F4D6}'}</div>
            <div style={styles.optionContent}>
              <h3 style={styles.optionTitle}>Just Import</h3>
              <p style={styles.optionDescription}>
                Import the book for reading now. You can generate narration later from the library.
              </p>
            </div>
          </div>

          <div
            style={{
              ...styles.optionCard,
              ...(selectedOption() === 'process'
                ? { 'border-color': 'var(--text-accent)', 'background-color': 'var(--bg-accent)' }
                : {}),
            }}
            onClick={() => setSelectedOption('process')}
            role="button"
            tabIndex={0}
          >
            <div style={styles.optionIcon}>{'\u{1F3A7}'}</div>
            <div style={styles.optionContent}>
              <h3 style={styles.optionTitle}>Process Now</h3>
              <p style={styles.optionDescription}>
                Import and start generating narration immediately. This may take a few minutes
                depending on book length.
              </p>
            </div>
          </div>
        </div>

        <div style={styles.checkbox}>
          <input
            type="checkbox"
            id="dontShowAgain"
            style={styles.checkboxInput}
            checked={dontShowAgain()}
            onChange={(e) => handleCheckboxChange(e.currentTarget.checked)}
          />
          <label for="dontShowAgain" style={styles.checkboxLabel}>
            Don't show this again (use selected option for future imports)
          </label>
        </div>

        <div style={styles.actions}>
          <button
            style={styles.cancelButton}
            onClick={props.onClose}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            disabled={importing()}
          >
            Cancel
          </button>
          <button
            style={{
              ...styles.confirmButton,
              ...(importing() ? { opacity: '0.6', cursor: 'not-allowed' } : {}),
            }}
            onClick={handleConfirm}
            onMouseEnter={(e) => { if (!importing()) e.currentTarget.style.opacity = '0.9'; }}
            onMouseLeave={(e) => { if (!importing()) e.currentTarget.style.opacity = '1'; }}
            disabled={importing()}
          >
            <span style={styles.buttonContent}>
              {importing() && <Spinner size={14} color="#ffffff" />}
              {importing()
                ? (selectedOption() === 'process' ? 'Processing...' : 'Importing...')
                : (selectedOption() === 'process' ? 'Process Now' : 'Import')
              }
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImportModal;
