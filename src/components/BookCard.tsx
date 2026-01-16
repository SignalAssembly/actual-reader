/**
 * BookCard Component
 *
 * Displays a book in the library with title, author, and narration status.
 * Status indicators per ARCHITECTURE.md:
 *   - text-only = no narration yet
 *   - processing = narration being generated
 *   - ready = narration complete, can play
 *
 * Uses GLOSSARY.md terminology: "narration" not "audio"
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Book } from '../types';

// =============================================================================
// Props Interface
// =============================================================================

export interface BookCardProps {
  /** The book to display */
  book: Book;
  /** Callback when the card is clicked (opens the book in reader) */
  onClick: () => void;
  /** Callback to generate narration for this book */
  onGenerateNarration?: () => void;
  /** Callback to delete this book from the library */
  onDelete?: () => void;
}

// =============================================================================
// Styles
// =============================================================================

const styles = {
  card: {
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '16px',
    borderRadius: '12px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    cursor: 'pointer',
    transition: 'box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease',
    minHeight: '140px',
    position: 'relative' as const,
  },
  cardHover: {
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    transform: 'translateY(-2px)',
    borderColor: 'var(--text-accent)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statusIcon: {
    fontSize: '24px',
    marginBottom: '8px',
  },
  kebabButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '4px',
    color: 'var(--text-secondary)',
    fontSize: '16px',
    lineHeight: 1,
    transition: 'background-color 0.2s, color 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '-4px',
    marginRight: '-4px',
  },
  kebabButtonHover: {
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
  },
  menu: {
    position: 'absolute' as const,
    top: '40px',
    right: '8px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
    zIndex: 100,
    minWidth: '160px',
    overflow: 'hidden',
  },
  menuItem: {
    display: 'block',
    width: '100%',
    padding: '10px 14px',
    border: 'none',
    background: 'none',
    textAlign: 'left' as const,
    fontSize: '14px',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  menuItemHover: {
    backgroundColor: 'var(--bg-primary)',
  },
  menuItemDisabled: {
    color: 'var(--text-secondary)',
    cursor: 'not-allowed',
    opacity: 0.6,
  },
  menuItemDanger: {
    color: '#dc2626',
  },
  title: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
    lineHeight: 1.3,
  },
  author: {
    margin: '6px 0 0 0',
    fontSize: '13px',
    color: 'var(--text-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusText: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
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
} {
  switch (status) {
    case 'ready':
      return {
        icon: '🎧', // ready - narration complete, can play
        label: 'Ready',
      };
    case 'generating':
      return {
        icon: '⏳', // processing - narration being generated
        label: 'Processing',
      };
    case 'none':
    default:
      return {
        icon: '📖', // text-only - no narration yet
        label: 'Text only',
      };
  }
}

// =============================================================================
// Component
// =============================================================================

export function BookCard({ book, onClick, onGenerateNarration, onDelete }: BookCardProps): JSX.Element {
  const status = getStatusIndicator(book.narrationStatus);
  const [menuOpen, setMenuOpen] = useState(false);
  const [kebabHover, setKebabHover] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const kebabRef = useRef<HTMLButtonElement>(null);

  const isProcessing = book.narrationStatus === 'generating';

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        kebabRef.current &&
        !kebabRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleKebabClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen((prev) => !prev);
  }, []);

  const handleOpen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    onClick();
  }, [onClick]);

  const handleGenerateNarration = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isProcessing || !onGenerateNarration) return;
    setMenuOpen(false);
    onGenerateNarration();
  }, [isProcessing, onGenerateNarration]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDelete) return;
    setMenuOpen(false);
    onDelete();
  }, [onDelete]);

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
        e.currentTarget.style.borderColor = '';
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
      <div style={styles.header}>
        <div style={styles.statusIcon}>{status.icon}</div>
        <button
          ref={kebabRef}
          style={{
            ...styles.kebabButton,
            ...(kebabHover ? styles.kebabButtonHover : {}),
          }}
          onClick={handleKebabClick}
          onMouseEnter={() => setKebabHover(true)}
          onMouseLeave={() => setKebabHover(false)}
          aria-label="Book options"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          &#8942;
        </button>
      </div>

      {menuOpen && (
        <div ref={menuRef} style={styles.menu} role="menu">
          <button
            style={{
              ...styles.menuItem,
              ...(hoveredItem === 'open' ? styles.menuItemHover : {}),
            }}
            onClick={handleOpen}
            onMouseEnter={() => setHoveredItem('open')}
            onMouseLeave={() => setHoveredItem(null)}
            role="menuitem"
          >
            Open
          </button>
          <button
            style={{
              ...styles.menuItem,
              ...(hoveredItem === 'narration' && !isProcessing ? styles.menuItemHover : {}),
              ...(isProcessing ? styles.menuItemDisabled : {}),
            }}
            onClick={handleGenerateNarration}
            onMouseEnter={() => setHoveredItem('narration')}
            onMouseLeave={() => setHoveredItem(null)}
            disabled={isProcessing}
            role="menuitem"
            aria-disabled={isProcessing}
          >
            Generate narration
          </button>
          <button
            style={{
              ...styles.menuItem,
              ...styles.menuItemDanger,
              ...(hoveredItem === 'delete' ? styles.menuItemHover : {}),
            }}
            onClick={handleDelete}
            onMouseEnter={() => setHoveredItem('delete')}
            onMouseLeave={() => setHoveredItem(null)}
            role="menuitem"
          >
            Delete
          </button>
        </div>
      )}

      <h3 style={styles.title}>{book.title}</h3>
      {book.author && <p style={styles.author}>{book.author}</p>}
      <div style={styles.footer}>
        <span style={styles.statusText}>{status.label}</span>
        <span style={styles.format}>{book.sourceFormat}</span>
      </div>
    </div>
  );
}

export default BookCard;
