/**
 * LibraryView Component (Solid)
 */

import { createSignal, createMemo, onMount, For, Show, type JSX } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { libraryStore } from '../stores/libraryStore';
import { BookCard } from '../components/BookCard';
import { BookListItem } from '../components/BookListItem';
import { ImportModal } from '../components/ImportModal';
import { Spinner } from '../components/Spinner';
import type { Book } from '../types';

type ViewMode = 'grid' | 'list';
const VIEW_MODE_KEY = 'libraryViewMode';

function formatRelativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return 'Just now';
  if (diff < 3600) {
    const minutes = Math.floor(diff / 60);
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
  if (diff < 86400) {
    const hours = Math.floor(diff / 3600);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  if (diff < 604800) {
    const days = Math.floor(diff / 86400);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }
  const weeks = Math.floor(diff / 604800);
  return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
}

const styles = {
  container: {
    padding: '24px',
    'max-width': '1200px',
    margin: '0 auto',
  } as JSX.CSSProperties,
  header: {
    display: 'flex',
    'justify-content': 'space-between',
    'align-items': 'center',
    'margin-bottom': '24px',
  } as JSX.CSSProperties,
  title: {
    'font-size': '24px',
    'font-weight': '600',
    margin: '0',
    color: 'var(--text-primary)',
  } as JSX.CSSProperties,
  viewToggle: {
    display: 'flex',
    'align-items': 'center',
    'background-color': 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    'border-radius': '6px',
    overflow: 'hidden',
  } as JSX.CSSProperties,
  viewButton: {
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'center',
    width: '36px',
    height: '32px',
    'background-color': 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    transition: 'background-color 0.2s, color 0.2s',
  } as JSX.CSSProperties,
  importButton: {
    padding: '10px 20px',
    'font-size': '14px',
    'font-weight': '500',
    'background-color': 'var(--text-accent)',
    color: '#ffffff',
    border: 'none',
    'border-radius': '8px',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  } as JSX.CSSProperties,
  grid: {
    display: 'grid',
    'grid-template-columns': 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '16px',
  } as JSX.CSSProperties,
  list: {
    display: 'flex',
    'flex-direction': 'column',
    gap: '8px',
  } as JSX.CSSProperties,
  emptyState: {
    display: 'flex',
    'flex-direction': 'column',
    'align-items': 'center',
    'justify-content': 'center',
    padding: '64px 24px',
    'text-align': 'center',
  } as JSX.CSSProperties,
  emptyIcon: {
    'font-size': '48px',
    'margin-bottom': '16px',
  } as JSX.CSSProperties,
  emptyTitle: {
    'font-size': '18px',
    'font-weight': '600',
    margin: '0 0 8px 0',
    color: 'var(--text-primary)',
  } as JSX.CSSProperties,
  emptyText: {
    'font-size': '14px',
    color: 'var(--text-secondary)',
    margin: '0 0 24px 0',
    'max-width': '400px',
  } as JSX.CSSProperties,
  error: {
    padding: '12px 16px',
    'background-color': '#fef2f2',
    border: '1px solid #fecaca',
    'border-radius': '8px',
    color: '#dc2626',
    'margin-bottom': '16px',
    cursor: 'pointer',
  } as JSX.CSSProperties,
  loading: {
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'center',
    padding: '48px',
    color: 'var(--text-secondary)',
  } as JSX.CSSProperties,
  recentSection: {
    'margin-bottom': '32px',
  } as JSX.CSSProperties,
  recentHeader: {
    'font-size': '18px',
    'font-weight': '600',
    margin: '0 0 16px 0',
    color: 'var(--text-primary)',
  } as JSX.CSSProperties,
  recentScrollContainer: {
    display: 'flex',
    gap: '16px',
    'overflow-x': 'auto',
    'padding-bottom': '8px',
    'scrollbar-width': 'thin',
  } as JSX.CSSProperties,
  recentCard: {
    display: 'flex',
    'flex-direction': 'column',
    'align-items': 'center',
    padding: '12px',
    'min-width': '140px',
    'max-width': '140px',
    'border-radius': '12px',
    'background-color': 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    cursor: 'pointer',
    transition: 'box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease',
    'flex-shrink': '0',
  } as JSX.CSSProperties,
  recentIcon: {
    'font-size': '32px',
    'margin-bottom': '8px',
  } as JSX.CSSProperties,
  recentTitle: {
    'font-size': '13px',
    'font-weight': '600',
    color: 'var(--text-primary)',
    'text-align': 'center',
    overflow: 'hidden',
    'text-overflow': 'ellipsis',
    display: '-webkit-box',
    '-webkit-line-clamp': '2',
    '-webkit-box-orient': 'vertical',
    'line-height': '1.3',
    'margin-bottom': '4px',
    width: '100%',
  } as JSX.CSSProperties,
  recentTime: {
    'font-size': '11px',
    color: 'var(--text-secondary)',
    'text-align': 'center',
  } as JSX.CSSProperties,
};

function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5" />
      <rect x="10" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5" />
      <rect x="1" y="10" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5" />
      <rect x="10" y="10" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="2" width="14" height="2.5" rx="0.5" stroke="currentColor" stroke-width="1.5" />
      <rect x="1" y="6.75" width="14" height="2.5" rx="0.5" stroke="currentColor" stroke-width="1.5" />
      <rect x="1" y="11.5" width="14" height="2.5" rx="0.5" stroke="currentColor" stroke-width="1.5" />
    </svg>
  );
}

export function LibraryView() {
  const navigate = useNavigate();
  const [showImportModal, setShowImportModal] = createSignal(false);
  const [pendingImportPath, setPendingImportPath] = createSignal<string | null>(null);
  const [viewMode, setViewMode] = createSignal<ViewMode>(
    () => {
      const saved = localStorage.getItem(VIEW_MODE_KEY);
      return (saved === 'list' || saved === 'grid') ? saved : 'grid';
    }
  );

  onMount(() => {
    libraryStore.fetchLibrary();
  });

  const recentlyOpenedBooks = createMemo(() =>
    libraryStore.books()
      .filter((book) => book.lastOpenedAt !== null)
      .sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))
      .slice(0, 6)
  );

  const getStatusIcon = (book: Book) => {
    switch (book.narrationStatus) {
      case 'ready': return '\u{1F3A7}';
      case 'generating': return '\u{23F3}';
      default: return '\u{1F4D6}';
    }
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  };

  const handleBookClick = (book: Book) => navigate(`/read/${book.id}`);
  const handleGenerateNarration = (book: Book) => navigate(`/read/${book.id}?process=true`);
  const handleDeleteBook = async (book: Book) => {
    try {
      await libraryStore.deleteBook(book.id);
    } catch (err) {
      console.error('Failed to delete book:', err);
    }
  };

  const handleImportClick = async () => {
    if (libraryStore.importing()) return;

    try {
      const selected = await openDialog({
        multiple: false,
        filters: [{ name: 'Books', extensions: ['epub', 'md', 'txt', 'pdf'] }],
      });

      if (selected && typeof selected === 'string') {
        const showModal = localStorage.getItem('showImportModal') !== 'false';
        if (showModal) {
          setPendingImportPath(selected);
          setShowImportModal(true);
        } else {
          await libraryStore.importBook(selected);
        }
      }
    } catch (err) {
      console.error('Failed to open file dialog:', err);
    }
  };

  const handleModalClose = () => {
    setShowImportModal(false);
    setPendingImportPath(null);
  };

  const handleJustImport = async () => {
    const path = pendingImportPath();
    if (path) {
      try {
        await libraryStore.importBook(path);
      } catch (err) {
        console.error('Failed to import book:', err);
      }
    }
    handleModalClose();
  };

  const handleProcessNow = async () => {
    const path = pendingImportPath();
    if (path) {
      try {
        const book = await libraryStore.importBook(path);
        navigate(`/read/${book.id}?process=true`);
      } catch (err) {
        console.error('Failed to import book:', err);
      }
    }
    handleModalClose();
  };

  const handleDontShowAgain = (dontShow: boolean) => {
    localStorage.setItem('showImportModal', dontShow ? 'false' : 'true');
  };

  return (
    <div style={styles.container}>
      <Show when={libraryStore.error()}>
        <div style={styles.error} onClick={libraryStore.clearError}>
          {libraryStore.error()}
        </div>
      </Show>

      <Show when={libraryStore.loading() && libraryStore.books().length === 0}>
        <div style={styles.loading}>Loading library...</div>
      </Show>

      <Show when={!libraryStore.loading() && libraryStore.books().length === 0}>
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>{'\u{1F4DA}'}</div>
          <h2 style={styles.emptyTitle}>Your library is empty</h2>
          <p style={styles.emptyText}>
            Import your first book to get started. Actual Reader supports EPUB, Markdown, TXT, and PDF files.
          </p>
          <button
            style={{
              ...styles.importButton,
              ...(libraryStore.importing() ? { opacity: '0.6', cursor: 'not-allowed' } : {}),
            }}
            onClick={handleImportClick}
            disabled={libraryStore.importing()}
          >
            <span style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
              {libraryStore.importing() && <Spinner size={14} color="#ffffff" />}
              {libraryStore.importing() ? 'Importing...' : 'Import Book'}
            </span>
          </button>
        </div>
      </Show>

      <Show when={libraryStore.books().length > 0}>
        <div style={styles.header}>
          <h1 style={styles.title}>Library</h1>
          <div style={{ display: 'flex', 'align-items': 'center', gap: '12px' }}>
            <div style={styles.viewToggle}>
              <button
                style={{
                  ...styles.viewButton,
                  ...(viewMode() === 'grid' ? { 'background-color': 'var(--bg-accent)', color: 'var(--text-accent)' } : {}),
                }}
                onClick={() => handleViewModeChange('grid')}
                title="Grid view"
              >
                <GridIcon />
              </button>
              <button
                style={{
                  ...styles.viewButton,
                  ...(viewMode() === 'list' ? { 'background-color': 'var(--bg-accent)', color: 'var(--text-accent)' } : {}),
                }}
                onClick={() => handleViewModeChange('list')}
                title="List view"
              >
                <ListIcon />
              </button>
            </div>
            <button
              style={{
                ...styles.importButton,
                ...(libraryStore.importing() ? { opacity: '0.6', cursor: 'not-allowed' } : {}),
              }}
              onClick={handleImportClick}
              disabled={libraryStore.importing()}
            >
              <span style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                {libraryStore.importing() && <Spinner size={14} color="#ffffff" />}
                {libraryStore.importing() ? 'Importing...' : 'Import Book'}
              </span>
            </button>
          </div>
        </div>

        <Show when={recentlyOpenedBooks().length > 0}>
          <div style={styles.recentSection}>
            <h2 style={styles.recentHeader}>Recently Opened</h2>
            <div style={styles.recentScrollContainer}>
              <For each={recentlyOpenedBooks()}>
                {(book) => (
                  <div
                    style={styles.recentCard}
                    onClick={() => handleBookClick(book)}
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
                  >
                    <div style={styles.recentIcon}>{getStatusIcon(book)}</div>
                    <div style={styles.recentTitle}>{book.title}</div>
                    <div style={styles.recentTime}>
                      {book.lastOpenedAt ? formatRelativeTime(book.lastOpenedAt) : ''}
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>

        <h2 style={{ ...styles.recentHeader, 'margin-bottom': '16px' }}>
          {recentlyOpenedBooks().length > 0 ? 'All Books' : ''}
        </h2>

        <Show when={viewMode() === 'grid'}>
          <div style={styles.grid}>
            <For each={libraryStore.books()}>
              {(book) => (
                <BookCard
                  book={book}
                  onClick={() => handleBookClick(book)}
                  onGenerateNarration={() => handleGenerateNarration(book)}
                  onDelete={() => handleDeleteBook(book)}
                />
              )}
            </For>
          </div>
        </Show>

        <Show when={viewMode() === 'list'}>
          <div style={styles.list}>
            <For each={libraryStore.books()}>
              {(book) => (
                <BookListItem
                  book={book}
                  onClick={() => handleBookClick(book)}
                />
              )}
            </For>
          </div>
        </Show>
      </Show>

      <Show when={showImportModal()}>
        <ImportModal
          onClose={handleModalClose}
          onJustImport={handleJustImport}
          onProcessNow={handleProcessNow}
          onDontShowAgain={handleDontShowAgain}
          importing={libraryStore.importing()}
        />
      </Show>
    </div>
  );
}

export default LibraryView;
