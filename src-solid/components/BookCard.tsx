/**
 * BookCard Component (Solid)
 */

import { createSignal, onCleanup, type JSX } from 'solid-js';
import type { Book } from '../types';

export interface BookCardProps {
  book: Book;
  onClick: () => void;
  onGenerateNarration?: () => void;
  onDelete?: () => void;
}

const styles = {
  card: {
    display: 'flex',
    'flex-direction': 'column',
    padding: '16px',
    'border-radius': '12px',
    'background-color': 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    cursor: 'pointer',
    transition: 'box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease',
    'min-height': '140px',
    position: 'relative',
  } as JSX.CSSProperties,
  header: {
    display: 'flex',
    'justify-content': 'space-between',
    'align-items': 'flex-start',
  } as JSX.CSSProperties,
  statusIcon: {
    'font-size': '24px',
    'margin-bottom': '8px',
  } as JSX.CSSProperties,
  kebabButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    'border-radius': '4px',
    color: 'var(--text-secondary)',
    'font-size': '16px',
    'line-height': '1',
    transition: 'background-color 0.2s, color 0.2s',
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'center',
    'margin-top': '-4px',
    'margin-right': '-4px',
  } as JSX.CSSProperties,
  menu: {
    position: 'absolute',
    top: '40px',
    right: '8px',
    'background-color': 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    'border-radius': '8px',
    'box-shadow': '0 4px 16px rgba(0, 0, 0, 0.15)',
    'z-index': '100',
    'min-width': '160px',
    overflow: 'hidden',
  } as JSX.CSSProperties,
  menuItem: {
    display: 'block',
    width: '100%',
    padding: '10px 14px',
    border: 'none',
    background: 'none',
    'text-align': 'left',
    'font-size': '14px',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  } as JSX.CSSProperties,
  title: {
    margin: '0',
    'font-size': '15px',
    'font-weight': '600',
    color: 'var(--text-primary)',
    overflow: 'hidden',
    'text-overflow': 'ellipsis',
    display: '-webkit-box',
    '-webkit-line-clamp': '2',
    '-webkit-box-orient': 'vertical',
    'line-height': '1.3',
  } as JSX.CSSProperties,
  author: {
    margin: '6px 0 0 0',
    'font-size': '13px',
    color: 'var(--text-secondary)',
    overflow: 'hidden',
    'text-overflow': 'ellipsis',
    'white-space': 'nowrap',
  } as JSX.CSSProperties,
  footer: {
    'margin-top': 'auto',
    'padding-top': '12px',
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'space-between',
  } as JSX.CSSProperties,
  statusText: {
    'font-size': '12px',
    color: 'var(--text-secondary)',
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
};

function getStatusIndicator(status: Book['narrationStatus']) {
  switch (status) {
    case 'ready':
      return { icon: '\u{1F3A7}', label: 'Ready' };
    case 'generating':
      return { icon: '\u{23F3}', label: 'Processing' };
    case 'none':
    default:
      return { icon: '\u{1F4D6}', label: 'Text only' };
  }
}

export function BookCard(props: BookCardProps) {
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [kebabHover, setKebabHover] = createSignal(false);
  const [hoveredItem, setHoveredItem] = createSignal<string | null>(null);
  let menuRef: HTMLDivElement | undefined;
  let kebabRef: HTMLButtonElement | undefined;

  const status = () => getStatusIndicator(props.book.narrationStatus);
  const isProcessing = () => props.book.narrationStatus === 'generating';

  const handleClickOutside = (event: MouseEvent) => {
    if (
      menuRef &&
      !menuRef.contains(event.target as Node) &&
      kebabRef &&
      !kebabRef.contains(event.target as Node)
    ) {
      setMenuOpen(false);
    }
  };

  const setupClickOutside = () => {
    if (menuOpen()) {
      document.addEventListener('mousedown', handleClickOutside);
      onCleanup(() => document.removeEventListener('mousedown', handleClickOutside));
    }
  };

  return (
    <div
      style={styles.card}
      onClick={props.onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.borderColor = 'var(--text-accent)';
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
          props.onClick();
        }
      }}
    >
      <div style={styles.header}>
        <div style={styles.statusIcon}>{status().icon}</div>
        <button
          ref={kebabRef}
          style={{
            ...styles.kebabButton,
            ...(kebabHover() ? { 'background-color': 'var(--bg-primary)', color: 'var(--text-primary)' } : {}),
          }}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((prev) => !prev);
            setupClickOutside();
          }}
          onMouseEnter={() => setKebabHover(true)}
          onMouseLeave={() => setKebabHover(false)}
          aria-label="Book options"
        >
          &#8942;
        </button>
      </div>

      {menuOpen() && (
        <div ref={menuRef} style={styles.menu} role="menu">
          <button
            style={{
              ...styles.menuItem,
              ...(hoveredItem() === 'open' ? { 'background-color': 'var(--bg-primary)' } : {}),
            }}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(false);
              props.onClick();
            }}
            onMouseEnter={() => setHoveredItem('open')}
            onMouseLeave={() => setHoveredItem(null)}
          >
            Open
          </button>
          <button
            style={{
              ...styles.menuItem,
              ...(hoveredItem() === 'narration' && !isProcessing() ? { 'background-color': 'var(--bg-primary)' } : {}),
              ...(isProcessing() ? { color: 'var(--text-secondary)', cursor: 'not-allowed', opacity: '0.6' } : {}),
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (!isProcessing() && props.onGenerateNarration) {
                setMenuOpen(false);
                props.onGenerateNarration();
              }
            }}
            onMouseEnter={() => setHoveredItem('narration')}
            onMouseLeave={() => setHoveredItem(null)}
            disabled={isProcessing()}
          >
            Generate narration
          </button>
          <button
            style={{
              ...styles.menuItem,
              color: '#dc2626',
              ...(hoveredItem() === 'delete' ? { 'background-color': 'var(--bg-primary)' } : {}),
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (props.onDelete) {
                setMenuOpen(false);
                props.onDelete();
              }
            }}
            onMouseEnter={() => setHoveredItem('delete')}
            onMouseLeave={() => setHoveredItem(null)}
          >
            Delete
          </button>
        </div>
      )}

      <h3 style={styles.title}>{props.book.title}</h3>
      {props.book.author && <p style={styles.author}>{props.book.author}</p>}
      <div style={styles.footer}>
        <span style={styles.statusText}>{status().label}</span>
        <span style={styles.format}>{props.book.sourceFormat}</span>
      </div>
    </div>
  );
}

export default BookCard;
