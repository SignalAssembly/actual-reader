/**
 * GeneratorView Component
 *
 * Shows the processing queue for TTS narration generation.
 * Displays books being processed with progress bars and status indicators.
 *
 * Uses GLOSSARY.md terminology: "narration" not "audio", "generation" not "processing"
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useLibraryStore } from '../stores/libraryStore';
import {
  onGenerationProgress,
  onGenerationComplete,
  onGenerationError,
  EventSubscriptionManager,
} from '../tauri/events';
import { cancelGeneration } from '../tauri/commands';
import type { BookId, GenerationStage, Book } from '../types';

// =============================================================================
// Types
// =============================================================================

interface ProcessingBook {
  bookId: BookId;
  title: string;
  stage: GenerationStage;
  current: number;
  total: number;
  message: string;
  error: string | null;
}

// =============================================================================
// Styles
// =============================================================================

const styles = {
  container: {
    padding: '24px',
    maxWidth: '800px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 600,
    margin: 0,
    color: 'var(--text-primary)',
  },
  backLink: {
    fontSize: '14px',
    color: 'var(--text-accent)',
    textDecoration: 'none',
  },
  queue: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  card: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    padding: '20px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px',
  },
  bookTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: 0,
  },
  cancelButton: {
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 500,
    backgroundColor: 'transparent',
    color: 'var(--error-color)',
    border: '1px solid var(--error-color)',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  stageInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
  },
  stageBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    fontSize: '12px',
    fontWeight: 500,
    borderRadius: '12px',
    textTransform: 'capitalize' as const,
  },
  stageExtracting: {
    backgroundColor: '#dbeafe',
    color: '#1d4ed8',
  },
  stageCaptioning: {
    backgroundColor: '#fef3c7',
    color: '#b45309',
  },
  stageNarrating: {
    backgroundColor: '#d1fae5',
    color: '#047857',
  },
  stageFinalizing: {
    backgroundColor: '#ede9fe',
    color: '#6d28d9',
  },
  stageMessage: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
  },
  progressContainer: {
    marginBottom: '8px',
  },
  progressBar: {
    width: '100%',
    height: '8px',
    backgroundColor: 'var(--border-color)',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'var(--text-accent)',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },
  progressText: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    textAlign: 'right' as const,
    marginTop: '4px',
  },
  errorCard: {
    borderColor: 'var(--error-color)',
  },
  errorMessage: {
    padding: '12px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    color: '#dc2626',
    fontSize: '13px',
    marginTop: '12px',
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
  libraryLink: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 500,
    backgroundColor: 'var(--text-accent)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    textDecoration: 'none',
    display: 'inline-block',
    transition: 'opacity 0.2s',
  },
  successToast: {
    position: 'fixed' as const,
    bottom: '24px',
    right: '24px',
    padding: '16px 20px',
    backgroundColor: '#10b981',
    color: '#ffffff',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: 500,
    animation: 'slideIn 0.3s ease',
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

function getStageStyle(stage: GenerationStage): React.CSSProperties {
  switch (stage) {
    case 'extracting':
      return { ...styles.stageBadge, ...styles.stageExtracting };
    case 'captioning':
      return { ...styles.stageBadge, ...styles.stageCaptioning };
    case 'narrating':
      return { ...styles.stageBadge, ...styles.stageNarrating };
    case 'finalizing':
      return { ...styles.stageBadge, ...styles.stageFinalizing };
    default:
      return styles.stageBadge;
  }
}

function getStageLabel(stage: GenerationStage): string {
  switch (stage) {
    case 'extracting':
      return 'Extracting';
    case 'captioning':
      return 'Captioning Images';
    case 'narrating':
      return 'Generating Narration';
    case 'finalizing':
      return 'Finalizing';
    default:
      return stage;
  }
}

// =============================================================================
// Component
// =============================================================================

export function GeneratorView() {
  const books = useLibraryStore((state) => state.books);
  const updateBook = useLibraryStore((state) => state.updateBook);

  // Processing state - maps bookId to processing info
  const [processingBooks, setProcessingBooks] = useState<Map<BookId, ProcessingBook>>(new Map());

  // Success toast state
  const [successToast, setSuccessToast] = useState<{ bookId: BookId; title: string } | null>(null);

  // Get book title by ID
  const getBookTitle = useCallback((bookId: BookId): string => {
    const book = books.find((b) => b.id === bookId);
    return book?.title ?? 'Unknown Book';
  }, [books]);

  // Handle cancel button click
  const handleCancel = useCallback(async (bookId: BookId) => {
    try {
      await cancelGeneration();
      // Remove from processing queue
      setProcessingBooks((prev) => {
        const next = new Map(prev);
        next.delete(bookId);
        return next;
      });
    } catch (err) {
      console.error('Failed to cancel generation:', err);
    }
  }, []);

  // Subscribe to generation events
  useEffect(() => {
    const manager = new EventSubscriptionManager();

    // Handle progress updates
    manager.add(
      onGenerationProgress((payload) => {
        setProcessingBooks((prev) => {
          const next = new Map(prev);
          next.set(payload.bookId, {
            bookId: payload.bookId,
            title: getBookTitle(payload.bookId),
            stage: payload.stage,
            current: payload.current,
            total: payload.total,
            message: payload.message,
            error: null,
          });
          return next;
        });
      })
    );

    // Handle completion
    manager.add(
      onGenerationComplete((payload) => {
        const title = getBookTitle(payload.bookId);

        // Remove from processing queue
        setProcessingBooks((prev) => {
          const next = new Map(prev);
          next.delete(payload.bookId);
          return next;
        });

        // Update book status in library store
        const book = books.find((b) => b.id === payload.bookId);
        if (book) {
          const updatedBook: Book = {
            ...book,
            narrationStatus: 'ready',
          };
          updateBook(updatedBook);
        }

        // Show success toast
        setSuccessToast({ bookId: payload.bookId, title });
        setTimeout(() => setSuccessToast(null), 4000);
      })
    );

    // Handle errors
    manager.add(
      onGenerationError((payload) => {
        setProcessingBooks((prev) => {
          const existing = prev.get(payload.bookId);
          const next = new Map(prev);
          next.set(payload.bookId, {
            bookId: payload.bookId,
            title: existing?.title ?? getBookTitle(payload.bookId),
            stage: existing?.stage ?? 'extracting',
            current: existing?.current ?? 0,
            total: existing?.total ?? 100,
            message: 'Generation failed',
            error: payload.error,
          });
          return next;
        });

        // Update book status in library store
        const book = books.find((b) => b.id === payload.bookId);
        if (book) {
          const updatedBook: Book = {
            ...book,
            narrationStatus: 'none',
          };
          updateBook(updatedBook);
        }
      })
    );

    return () => {
      manager.unlistenAll();
    };
  }, [books, getBookTitle, updateBook]);

  // Also check for books with 'generating' status that aren't in our local state
  useEffect(() => {
    const generatingBooks = books.filter((b) => b.narrationStatus === 'generating');
    setProcessingBooks((prev) => {
      const next = new Map(prev);
      for (const book of generatingBooks) {
        if (!next.has(book.id)) {
          next.set(book.id, {
            bookId: book.id,
            title: book.title,
            stage: 'extracting',
            current: 0,
            total: 100,
            message: 'Starting...',
            error: null,
          });
        }
      }
      return next;
    });
  }, [books]);

  const processingList = Array.from(processingBooks.values());

  // Empty state
  if (processingList.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Generator</h1>
        </div>

        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>*</div>
          <h2 style={styles.emptyTitle}>No books processing</h2>
          <p style={styles.emptyText}>
            Generate narration from the Library. Select a book and click "Generate Narration" to add it to the queue.
          </p>
          <Link
            to="/library"
            style={styles.libraryLink}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            Go to Library
          </Link>
        </div>
      </div>
    );
  }

  // Processing queue
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Generator</h1>
        <Link to="/library" style={styles.backLink}>
          Back to Library
        </Link>
      </div>

      <div style={styles.queue}>
        {processingList.map((item) => {
          const percent = item.total > 0 ? Math.round((item.current / item.total) * 100) : 0;

          return (
            <div
              key={item.bookId}
              style={{
                ...styles.card,
                ...(item.error ? styles.errorCard : {}),
              }}
            >
              <div style={styles.cardHeader}>
                <h3 style={styles.bookTitle}>{item.title}</h3>
                <button
                  style={styles.cancelButton}
                  onClick={() => handleCancel(item.bookId)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--error-color)';
                    e.currentTarget.style.color = '#ffffff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--error-color)';
                  }}
                >
                  Cancel
                </button>
              </div>

              <div style={styles.stageInfo}>
                <span style={getStageStyle(item.stage)}>
                  {getStageLabel(item.stage)}
                </span>
                <span style={styles.stageMessage}>{item.message}</span>
              </div>

              <div style={styles.progressContainer}>
                <div style={styles.progressBar}>
                  <div
                    style={{
                      ...styles.progressFill,
                      width: `${percent}%`,
                    }}
                  />
                </div>
                <div style={styles.progressText}>{percent}%</div>
              </div>

              {item.error && (
                <div style={styles.errorMessage}>
                  {item.error}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Success Toast */}
      {successToast && (
        <div style={styles.successToast}>
          <span>Narration complete: {successToast.title}</span>
        </div>
      )}
    </div>
  );
}

export default GeneratorView;
