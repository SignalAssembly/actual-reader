/**
 * BookListItem Component
 *
 * Displays a book in list view with title, author, format, narration status, and last opened date.
 * Status indicators per ARCHITECTURE.md:
 *   - text-only = no narration yet
 *   - processing = narration being generated
 *   - ready = narration complete, can play
 *
 * Uses GLOSSARY.md terminology: "narration" not "audio"
 */

import type { Book } from '../types';

// =============================================================================
// Props Interface
// =============================================================================

export interface BookListItemProps {
  /** The book to display */
  book: Book;
  /** Callback when the item is clicked */
  onClick: () => void;
}

// =============================================================================
// Styles
// =============================================================================

const styles = {
  row: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease, border-color 0.2s ease',
    gap: '16px',
  },
  rowHover: {
    backgroundColor: 'var(--bg-accent)',
    borderColor: 'var(--text-accent)',
  },
  statusIcon: {
    fontSize: '20px',
    flexShrink: 0,
    width: '28px',
    textAlign: 'center' as const,
  },
  titleAuthorContainer: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  title: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  author: {
    margin: '2px 0 0 0',
    fontSize: '12px',
    color: 'var(--text-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  column: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    flexShrink: 0,
    textAlign: 'center' as const,
  },
  formatColumn: {
    width: '70px',
  },
  statusColumn: {
    width: '90px',
  },
  dateColumn: {
    width: '100px',
    textAlign: 'right' as const,
  },
  format: {
    fontSize: '11px',
    fontWeight: 500,
    textTransform: 'uppercase' as const,
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--bg-primary)',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  statusBadge: {
    fontSize: '11px',
    fontWeight: 500,
    padding: '2px 8px',
    borderRadius: '4px',
  },
  statusReady: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    color: 'var(--success-color)',
  },
  statusGenerating: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    color: 'var(--warning-color)',
  },
  statusNone: {
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-secondary)',
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the status indicator based on narration status
 * Per ARCHITECTURE.md Data Flow section
 */
function getStatusIndicator(status: Book['narrationStatus']): {
  icon: string;
  label: string;
  style: React.CSSProperties;
} {
  switch (status) {
    case 'ready':
      return {
        icon: '🎧',
        label: 'Ready',
        style: { ...styles.statusBadge, ...styles.statusReady },
      };
    case 'generating':
      return {
        icon: '⏳',
        label: 'Processing',
        style: { ...styles.statusBadge, ...styles.statusGenerating },
      };
    case 'none':
    default:
      return {
        icon: '📖',
        label: 'Text only',
        style: { ...styles.statusBadge, ...styles.statusNone },
      };
  }
}

/**
 * Format a timestamp for display
 */
function formatDate(timestamp: number | null): string {
  if (!timestamp) {
    return 'Never';
  }

  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  }
}

// =============================================================================
// Component
// =============================================================================

export function BookListItem({ book, onClick }: BookListItemProps): JSX.Element {
  const status = getStatusIndicator(book.narrationStatus);

  return (
    <div
      style={styles.row}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--bg-accent)';
        e.currentTarget.style.borderColor = 'var(--text-accent)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
        e.currentTarget.style.borderColor = 'var(--border-color)';
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div style={styles.statusIcon}>{status.icon}</div>

      <div style={styles.titleAuthorContainer}>
        <h3 style={styles.title}>{book.title}</h3>
        {book.author && <p style={styles.author}>{book.author}</p>}
      </div>

      <div style={{ ...styles.column, ...styles.formatColumn }}>
        <span style={styles.format}>{book.sourceFormat}</span>
      </div>

      <div style={{ ...styles.column, ...styles.statusColumn }}>
        <span style={status.style}>{status.label}</span>
      </div>

      <div style={{ ...styles.column, ...styles.dateColumn }}>
        {formatDate(book.lastOpenedAt)}
      </div>
    </div>
  );
}

export default BookListItem;
