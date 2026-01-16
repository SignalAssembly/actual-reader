/**
 * ImportModal Component
 *
 * First-time import modal explaining processing options.
 * Per PRD.md User Stories:
 *   - First-time modal explains processing (with "Don't show again" checked by default)
 *   - User can choose "Process Now" or "Just Import" on import
 *
 * Uses GLOSSARY.md terminology: "narration" not "audio", "generate" not "synthesize"
 */

import { useState, useCallback } from 'react';
import { Spinner } from './Spinner';

// =============================================================================
// Props Interface
// =============================================================================

export interface ImportModalProps {
  /** Callback when modal is closed/dismissed */
  onClose: () => void;
  /** Callback when "Just Import" is selected */
  onJustImport: () => void;
  /** Callback when "Process Now" is selected */
  onProcessNow: () => void;
  /** Callback when "Don't show again" preference changes */
  onDontShowAgain: (dontShow: boolean) => void;
  /** Whether an import is currently in progress */
  importing?: boolean;
}

// =============================================================================
// Styles
// =============================================================================

const styles = {
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: 'var(--bg-primary)',
    borderRadius: '16px',
    padding: '24px',
    maxWidth: '480px',
    width: '90%',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
    marginBottom: '20px',
  },
  icon: {
    fontSize: '32px',
    flexShrink: 0,
  },
  title: {
    fontSize: '20px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: '0 0 8px 0',
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    margin: 0,
    lineHeight: 1.5,
  },
  options: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    marginBottom: '20px',
  },
  optionCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '16px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '12px',
    border: '2px solid transparent',
    cursor: 'pointer',
    transition: 'border-color 0.2s, background-color 0.2s',
  },
  optionCardSelected: {
    borderColor: 'var(--text-accent)',
    backgroundColor: 'var(--bg-accent)',
  },
  optionIcon: {
    fontSize: '24px',
    flexShrink: 0,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: '0 0 4px 0',
  },
  optionDescription: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    margin: 0,
    lineHeight: 1.4,
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '24px',
  },
  checkboxInput: {
    width: '16px',
    height: '16px',
    cursor: 'pointer',
  },
  checkboxLabel: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  actions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 500,
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  confirmButton: {
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: 500,
    backgroundColor: 'var(--text-accent)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  confirmButtonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  buttonContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
};

// =============================================================================
// Component
// =============================================================================

export function ImportModal({
  onClose,
  onJustImport,
  onProcessNow,
  onDontShowAgain,
  importing = false,
}: ImportModalProps) {
  // "Don't show again" is checked by default per PRD
  const [dontShowAgain, setDontShowAgain] = useState(true);
  const [selectedOption, setSelectedOption] = useState<'import' | 'process'>('import');

  // Handle checkbox change
  const handleCheckboxChange = useCallback((checked: boolean) => {
    setDontShowAgain(checked);
    onDontShowAgain(checked);
  }, [onDontShowAgain]);

  // Handle confirm button
  const handleConfirm = useCallback(() => {
    if (selectedOption === 'process') {
      onProcessNow();
    } else {
      onJustImport();
    }
  }, [selectedOption, onProcessNow, onJustImport]);

  // Handle overlay click (close modal)
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  return (
    <div style={styles.overlay} onClick={handleOverlayClick}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.icon}>📚</div>
          <div>
            <h2 style={styles.title}>Import Book</h2>
            <p style={styles.subtitle}>
              You can generate narration now or import the book for reading first.
              Narration can always be generated later.
            </p>
          </div>
        </div>

        {/* Options */}
        <div style={styles.options}>
          {/* Just Import option */}
          <div
            style={{
              ...styles.optionCard,
              ...(selectedOption === 'import' ? styles.optionCardSelected : {}),
            }}
            onClick={() => setSelectedOption('import')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSelectedOption('import');
              }
            }}
          >
            <div style={styles.optionIcon}>📖</div>
            <div style={styles.optionContent}>
              <h3 style={styles.optionTitle}>Just Import</h3>
              <p style={styles.optionDescription}>
                Import the book for reading now. You can generate narration later from the library.
              </p>
            </div>
          </div>

          {/* Process Now option */}
          <div
            style={{
              ...styles.optionCard,
              ...(selectedOption === 'process' ? styles.optionCardSelected : {}),
            }}
            onClick={() => setSelectedOption('process')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSelectedOption('process');
              }
            }}
          >
            <div style={styles.optionIcon}>🎧</div>
            <div style={styles.optionContent}>
              <h3 style={styles.optionTitle}>Process Now</h3>
              <p style={styles.optionDescription}>
                Import and start generating narration immediately. This may take a few minutes
                depending on book length.
              </p>
            </div>
          </div>
        </div>

        {/* Don't show again checkbox */}
        <div style={styles.checkbox}>
          <input
            type="checkbox"
            id="dontShowAgain"
            style={styles.checkboxInput}
            checked={dontShowAgain}
            onChange={(e) => handleCheckboxChange(e.target.checked)}
          />
          <label
            htmlFor="dontShowAgain"
            style={styles.checkboxLabel}
          >
            Don't show this again (use selected option for future imports)
          </label>
        </div>

        {/* Actions */}
        <div style={styles.actions}>
          <button
            style={styles.cancelButton}
            onClick={onClose}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            disabled={importing}
          >
            Cancel
          </button>
          <button
            style={{
              ...styles.confirmButton,
              ...(importing ? styles.confirmButtonDisabled : {}),
            }}
            onClick={handleConfirm}
            onMouseEnter={(e) => { if (!importing) e.currentTarget.style.opacity = '0.9'; }}
            onMouseLeave={(e) => { if (!importing) e.currentTarget.style.opacity = '1'; }}
            disabled={importing}
          >
            <span style={styles.buttonContent}>
              {importing && <Spinner size={14} color="#ffffff" />}
              {importing
                ? (selectedOption === 'process' ? 'Processing...' : 'Importing...')
                : (selectedOption === 'process' ? 'Process Now' : 'Import')
              }
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImportModal;
