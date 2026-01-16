/**
 * LibraryView Component
 *
 * Displays all books in the library with status indicators.
 * Supports both grid (thumbnail) and list (details) views with a toggle.
 * View preference is persisted in localStorage.
 *
 * Status indicators per ARCHITECTURE.md:
 *   - text-only = no narration yet
 *   - processing = narration being generated
 *   - ready = narration complete, can play
 *
 * Uses GLOSSARY.md terminology: "library" not "bookshelf", "narration" not "audio"
 */

import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLibraryStore } from '../stores/libraryStore';
import { BookCard } from '../components/BookCard';
import { BookListItem } from '../components/BookListItem';
import { ImportModal } from '../components/ImportModal';
import { Spinner } from '../components/Spinner';
import type { Book } from '../types';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format a timestamp as relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) {
    return 'Just now';
  } else if (diff < 3600) {
    const minutes = Math.floor(diff / 60);
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  } else if (diff < 86400) {
    const hours = Math.floor(diff / 3600);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  } else if (diff < 604800) {
    const days = Math.floor(diff / 86400);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  } else if (diff < 2592000) {
    const weeks = Math.floor(diff / 604800);
    return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  } else {
    const months = Math.floor(diff / 2592000);
    return `${months} month${months === 1 ? '' : 's'} ago`;
  }
}

// =============================================================================
// Types
// =============================================================================

type ViewMode = 'grid' | 'list';

const VIEW_MODE_KEY = 'libraryViewMode';

// =============================================================================
// Tauri Dialog Import
// =============================================================================

import { open as openDialog } from '@tauri-apps/plugin-dialog';

// =============================================================================
// Styles
// =============================================================================

const styles = {
  container: {
    padding: '24px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 600,
    margin: 0,
    color: 'var(--text-primary)',
  },
  viewToggle: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  viewButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '32px',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    transition: 'background-color 0.2s, color 0.2s',
  },
  viewButtonActive: {
    backgroundColor: 'var(--bg-accent)',
    color: 'var(--text-accent)',
  },
  importButton: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 500,
    backgroundColor: 'var(--text-accent)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '16px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  listHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 16px',
    gap: '16px',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    color: 'var(--text-secondary)',
    letterSpacing: '0.5px',
  },
  listHeaderIcon: {
    width: '28px',
  },
  listHeaderTitle: {
    flex: 1,
  },
  listHeaderFormat: {
    width: '70px',
    textAlign: 'center' as const,
  },
  listHeaderStatus: {
    width: '90px',
    textAlign: 'center' as const,
  },
  listHeaderDate: {
    width: '100px',
    textAlign: 'right' as const,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '64px 24px',
    textAlign: 'center' as const,
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: 600,
    margin: '0 0 8px 0',
    color: 'var(--text-primary)',
  },
  emptyText: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    margin: '0 0 24px 0',
    maxWidth: '400px',
  },
  error: {
    padding: '12px 16px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    color: '#dc2626',
    marginBottom: '16px',
    cursor: 'pointer',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px',
    color: 'var(--text-secondary)',
  },
  // Recently Opened section styles
  recentSection: {
    marginBottom: '32px',
  },
  recentHeader: {
    fontSize: '18px',
    fontWeight: 600,
    margin: '0 0 16px 0',
    color: 'var(--text-primary)',
  },
  recentScrollContainer: {
    display: 'flex',
    gap: '16px',
    overflowX: 'auto' as const,
    paddingBottom: '8px',
    scrollbarWidth: 'thin' as const,
  },
  recentCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '12px',
    minWidth: '140px',
    maxWidth: '140px',
    borderRadius: '12px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    cursor: 'pointer',
    transition: 'box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease',
    flexShrink: 0,
  },
  recentCardHover: {
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    transform: 'translateY(-2px)',
    borderColor: 'var(--text-accent)',
  },
  recentIcon: {
    fontSize: '32px',
    marginBottom: '8px',
  },
  recentTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    textAlign: 'center' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
    lineHeight: 1.3,
    marginBottom: '4px',
    width: '100%',
  },
  recentTime: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    textAlign: 'center' as const,
  },
  // Import button states
  importButtonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  importButtonContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
};

// =============================================================================
// View Toggle Icons
// =============================================================================

function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="10" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1" y="10" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="10" y="10" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="2" width="14" height="2.5" rx="0.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1" y="6.75" width="14" height="2.5" rx="0.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1" y="11.5" width="14" height="2.5" rx="0.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

// =============================================================================
// Component
// =============================================================================

export function LibraryView() {
  const navigate = useNavigate();
  const { books, loading, importing, error, importBook, deleteBook, clearError } = useLibraryStore();
  const [showImportModal, setShowImportModal] = useState(false);
  const [pendingImportPath, setPendingImportPath] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    // Initialize from localStorage
    const saved = localStorage.getItem(VIEW_MODE_KEY);
    return (saved === 'list' || saved === 'grid') ? saved : 'grid';
  });

  // Get recently opened books (top 6, sorted by lastOpenedAt descending)
  const recentlyOpenedBooks = useMemo(() => {
    return books
      .filter((book) => book.lastOpenedAt !== null)
      .sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))
      .slice(0, 6);
  }, [books]);

  // Get status icon for a book
  const getStatusIcon = useCallback((book: Book) => {
    switch (book.narrationStatus) {
      case 'ready':
        return String.fromCodePoint(0x1F3A7); // headphones emoji
      case 'generating':
        return String.fromCodePoint(0x23F3); // hourglass emoji
      case 'none':
      default:
        return String.fromCodePoint(0x1F4D6); // open book emoji
    }
  }, []);

  // Persist view mode changes to localStorage
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  }, []);

  // Handle clicking on a book card
  const handleBookClick = useCallback((book: Book) => {
    navigate(`/read/${book.id}`);
  }, [navigate]);

  // Handle generating narration for a book
  const handleGenerateNarration = useCallback((book: Book) => {
    // Navigate to reader with process=true to trigger narration generation
    navigate(`/read/${book.id}?process=true`);
  }, [navigate]);

  // Handle deleting a book
  const handleDeleteBook = useCallback(async (book: Book) => {
    // Optionally add a confirmation dialog here
    try {
      await deleteBook(book.id);
    } catch (err) {
      console.error('Failed to delete book:', err);
    }
  }, [deleteBook]);

  // Handle import button click
  const handleImportClick = useCallback(async () => {
    // Don't allow import if already importing
    if (importing) return;

    try {
      const selected = await openDialog({
        multiple: false,
        filters: [
          {
            name: 'Books',
            extensions: ['epub', 'md', 'txt', 'pdf'],
          },
        ],
      });

      if (selected && typeof selected === 'string') {
        // Check if we should show the import modal
        const showModal = localStorage.getItem('showImportModal') !== 'false';

        if (showModal) {
          setPendingImportPath(selected);
          setShowImportModal(true);
        } else {
          // Just import without processing
          await importBook(selected);
        }
      }
    } catch (err) {
      console.error('Failed to open file dialog:', err);
    }
  }, [importBook, importing]);

  // Handle modal close
  const handleModalClose = useCallback(() => {
    setShowImportModal(false);
    setPendingImportPath(null);
  }, []);

  // Handle "Just Import" from modal
  const handleJustImport = useCallback(async () => {
    if (pendingImportPath) {
      try {
        await importBook(pendingImportPath);
      } catch (err) {
        console.error('Failed to import book:', err);
      }
    }
    handleModalClose();
  }, [pendingImportPath, importBook, handleModalClose]);

  // Handle "Process Now" from modal
  const handleProcessNow = useCallback(async () => {
    if (pendingImportPath) {
      try {
        const book = await importBook(pendingImportPath);
        // Navigate to reader which will show processing option
        navigate(`/read/${book.id}?process=true`);
      } catch (err) {
        console.error('Failed to import book:', err);
      }
    }
    handleModalClose();
  }, [pendingImportPath, importBook, navigate, handleModalClose]);

  // Handle "Don't show again" checkbox
  const handleDontShowAgain = useCallback((dontShow: boolean) => {
    localStorage.setItem('showImportModal', dontShow ? 'false' : 'true');
  }, []);

  // Render loading state
  if (loading && books.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading library...</div>
      </div>
    );
  }

  // Render empty state
  if (books.length === 0) {
    return (
      <div style={styles.container}>
        {error && (
          <div style={styles.error} onClick={clearError}>
            {error}
          </div>
        )}
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>📚</div>
          <h2 style={styles.emptyTitle}>Your library is empty</h2>
          <p style={styles.emptyText}>
            Import your first book to get started. Actual Reader supports EPUB, Markdown, TXT, and PDF files.
          </p>
          <button
            style={{
              ...styles.importButton,
              ...(importing ? styles.importButtonDisabled : {}),
            }}
            onClick={handleImportClick}
            onMouseEnter={(e) => { if (!importing) e.currentTarget.style.opacity = '0.9'; }}
            onMouseLeave={(e) => { if (!importing) e.currentTarget.style.opacity = '1'; }}
            disabled={importing}
          >
            <span style={styles.importButtonContent}>
              {importing && <Spinner size={14} color="#ffffff" />}
              {importing ? 'Importing...' : 'Import Book'}
            </span>
          </button>
        </div>

        {showImportModal && (
          <ImportModal
            onClose={handleModalClose}
            onJustImport={handleJustImport}
            onProcessNow={handleProcessNow}
            onDontShowAgain={handleDontShowAgain}
            importing={importing}
          />
        )}
      </div>
    );
  }

  // Render library grid
  return (
    <div style={styles.container}>
      {error && (
        <div style={styles.error} onClick={clearError}>
          {error}
        </div>
      )}

      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.title}>Library</h1>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.viewToggle}>
            <button
              style={{
                ...styles.viewButton,
                ...(viewMode === 'grid' ? styles.viewButtonActive : {}),
              }}
              onClick={() => handleViewModeChange('grid')}
              title="Grid view"
              aria-label="Grid view"
              aria-pressed={viewMode === 'grid'}
            >
              <GridIcon />
            </button>
            <button
              style={{
                ...styles.viewButton,
                ...(viewMode === 'list' ? styles.viewButtonActive : {}),
              }}
              onClick={() => handleViewModeChange('list')}
              title="List view"
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
            >
              <ListIcon />
            </button>
          </div>
          <button
            style={{
              ...styles.importButton,
              ...(importing ? styles.importButtonDisabled : {}),
            }}
            onClick={handleImportClick}
            onMouseEnter={(e) => { if (!importing) e.currentTarget.style.opacity = '0.9'; }}
            onMouseLeave={(e) => { if (!importing) e.currentTarget.style.opacity = '1'; }}
            disabled={importing}
          >
            <span style={styles.importButtonContent}>
              {importing && <Spinner size={14} color="#ffffff" />}
              {importing ? 'Importing...' : 'Import Book'}
            </span>
          </button>
        </div>
      </div>

      {/* Recently Opened Section */}
      {recentlyOpenedBooks.length > 0 && (
        <div style={styles.recentSection}>
          <h2 style={styles.recentHeader}>Recently Opened</h2>
          <div style={styles.recentScrollContainer}>
            {recentlyOpenedBooks.map((book) => (
              <div
                key={book.id}
                style={styles.recentCard}
                onClick={() => handleBookClick(book)}
                onMouseEnter={(e) => {
                  Object.assign(e.currentTarget.style, styles.recentCardHover);
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
                    handleBookClick(book);
                  }
                }}
              >
                <div style={styles.recentIcon}>{getStatusIcon(book)}</div>
                <div style={styles.recentTitle}>{book.title}</div>
                <div style={styles.recentTime}>
                  {book.lastOpenedAt ? formatRelativeTime(book.lastOpenedAt) : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Books Section */}
      <h2 style={{ ...styles.recentHeader, marginBottom: '16px' }}>
        {recentlyOpenedBooks.length > 0 ? 'All Books' : ''}
      </h2>

      {viewMode === 'grid' ? (
        <div style={styles.grid}>
          {books.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              onClick={() => handleBookClick(book)}
              onGenerateNarration={() => handleGenerateNarration(book)}
              onDelete={() => handleDeleteBook(book)}
            />
          ))}
        </div>
      ) : (
        <div style={styles.list}>
          <div style={styles.listHeader}>
            <div style={styles.listHeaderIcon}></div>
            <div style={styles.listHeaderTitle}>Title / Author</div>
            <div style={styles.listHeaderFormat}>Format</div>
            <div style={styles.listHeaderStatus}>Status</div>
            <div style={styles.listHeaderDate}>Last Opened</div>
          </div>
          {books.map((book) => (
            <BookListItem
              key={book.id}
              book={book}
              onClick={() => handleBookClick(book)}
            />
          ))}
        </div>
      )}

      {showImportModal && (
        <ImportModal
          onClose={handleModalClose}
          onJustImport={handleJustImport}
          onProcessNow={handleProcessNow}
          onDontShowAgain={handleDontShowAgain}
          importing={importing}
        />
      )}
    </div>
  );
}

export default LibraryView;
