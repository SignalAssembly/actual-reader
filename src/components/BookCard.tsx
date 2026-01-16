/**
 * BookCard Component
 *
 * Displays a book in the library with title, author, and narration status.
 * Uses GLOSSARY.md terminology: "narration" not "audio"
 */

import type { Book } from '../types';

// =============================================================================
// Props Interface
// =============================================================================

export interface BookCardProps {
  /** The book to display */
  book: Book;
  /** Callback when the card is clicked */
  onClick: () => void;
}

// =============================================================================
// Styles
// =============================================================================

const styles = {
  card: {
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '16px',
    borderRadius: '8px',
    backgroundColor: '#ffffff',
    border: '1px solid #e0e0e0',
    cursor: 'pointer',
    transition: 'box-shadow 0.2s ease, transform 0.2s ease',
    minHeight: '120px',
  },
  cardHover: {
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    transform: 'translateY(-2px)',
  },
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
    color: '#1a1a1a',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  author: {
    margin: '4px 0 0 0',
    fontSize: '14px',
    color: '#666666',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  badgeContainer: {
    marginTop: 'auto',
    paddingTop: '12px',
  },
  badge: {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 500,
  },
  badgeReady: {
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
  },
  badgeGenerating: {
    backgroundColor: '#fff3e0',
    color: '#ef6c00',
  },
  badgeNone: {
    backgroundColor: '#f5f5f5',
    color: '#757575',
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the badge style and text based on narration status
 */
function getNarrationBadge(status: Book['narrationStatus']): {
  text: string;
  style: React.CSSProperties;
} {
  switch (status) {
    case 'ready':
      return {
        text: 'Ready',
        style: { ...styles.badge, ...styles.badgeReady },
      };
    case 'generating':
      return {
        text: 'Generating...',
        style: { ...styles.badge, ...styles.badgeGenerating },
      };
    case 'none':
    default:
      return {
        text: 'No Narration',
        style: { ...styles.badge, ...styles.badgeNone },
      };
  }
}

// =============================================================================
// Component
// =============================================================================

export function BookCard({ book, onClick }: BookCardProps): JSX.Element {
  const badge = getNarrationBadge(book.narrationStatus);

  return (
    <div
      style={styles.card}
      onClick={onClick}
      onMouseEnter={(e) => {
        Object.assign(e.currentTarget.style, styles.cardHover);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '';
        e.currentTarget.style.transform = '';
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
      <h3 style={styles.title}>{book.title}</h3>
      {book.author && <p style={styles.author}>{book.author}</p>}
      <div style={styles.badgeContainer}>
        <span style={badge.style}>{badge.text}</span>
      </div>
    </div>
  );
}

export default BookCard;
