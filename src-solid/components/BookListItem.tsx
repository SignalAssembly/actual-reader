/**
 * BookListItem Component (Solid)
 */

import type { JSX } from 'solid-js';
import type { Book } from '../types';

export interface BookListItemProps {
  book: Book;
  onClick: () => void;
}

const styles = {
  row: {
    display: 'flex',
    'align-items': 'center',
    padding: '12px 16px',
    'background-color': 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    'border-radius': '8px',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease, border-color 0.2s ease',
    gap: '16px',
  } as JSX.CSSProperties,
  statusIcon: {
    'font-size': '20px',
    'flex-shrink': '0',
    width: '28px',
    'text-align': 'center',
  } as JSX.CSSProperties,
  titleAuthorContainer: {
    flex: '1',
    'min-width': '0',
    overflow: 'hidden',
  } as JSX.CSSProperties,
  title: {
    margin: '0',
    'font-size': '14px',
    'font-weight': '600',
    color: 'var(--text-primary)',
    overflow: 'hidden',
    'text-overflow': 'ellipsis',
    'white-space': 'nowrap',
  } as JSX.CSSProperties,
  author: {
    margin: '2px 0 0 0',
    'font-size': '12px',
    color: 'var(--text-secondary)',
    overflow: 'hidden',
    'text-overflow': 'ellipsis',
    'white-space': 'nowrap',
  } as JSX.CSSProperties,
  column: {
    'font-size': '12px',
    color: 'var(--text-secondary)',
    'flex-shrink': '0',
    'text-align': 'center',
  } as JSX.CSSProperties,
  format: {
    'font-size': '11px',
    'font-weight': '500',
    'text-transform': 'uppercase',
    color: 'var(--text-secondary)',
    'background-color': 'var(--bg-primary)',
    padding: '2px 6px',
    'border-radius': '4px',
  } as JSX.CSSProperties,
  statusBadge: {
    'font-size': '11px',
    'font-weight': '500',
    padding: '2px 8px',
    'border-radius': '4px',
  } as JSX.CSSProperties,
};

function getStatusIndicator(status: Book['narrationStatus']) {
  switch (status) {
    case 'ready':
      return {
        icon: '\u{1F3A7}',
        label: 'Ready',
        style: { ...styles.statusBadge, 'background-color': 'rgba(34, 197, 94, 0.1)', color: 'var(--success-color)' },
      };
    case 'generating':
      return {
        icon: '\u{23F3}',
        label: 'Processing',
        style: { ...styles.statusBadge, 'background-color': 'rgba(245, 158, 11, 0.1)', color: 'var(--warning-color)' },
      };
    case 'none':
    default:
      return {
        icon: '\u{1F4D6}',
        label: 'Text only',
        style: { ...styles.statusBadge, 'background-color': 'var(--bg-primary)', color: 'var(--text-secondary)' },
      };
  }
}

function formatDate(timestamp: number | null): string {
  if (!timestamp) return 'Never';
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function BookListItem(props: BookListItemProps) {
  const status = () => getStatusIndicator(props.book.narrationStatus);

  return (
    <div
      style={styles.row}
      onClick={props.onClick}
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
          props.onClick();
        }
      }}
    >
      <div style={styles.statusIcon}>{status().icon}</div>

      <div style={styles.titleAuthorContainer}>
        <h3 style={styles.title}>{props.book.title}</h3>
        {props.book.author && <p style={styles.author}>{props.book.author}</p>}
      </div>

      <div style={{ ...styles.column, width: '70px' }}>
        <span style={styles.format}>{props.book.sourceFormat}</span>
      </div>

      <div style={{ ...styles.column, width: '90px' }}>
        <span style={status().style}>{status().label}</span>
      </div>

      <div style={{ ...styles.column, width: '100px', 'text-align': 'right' }}>
        {formatDate(props.book.lastOpenedAt)}
      </div>
    </div>
  );
}

export default BookListItem;
