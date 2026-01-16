/**
 * GeneratorView Component (Solid)
 */

import { createSignal, createEffect, onMount, onCleanup, For, Show, type JSX } from 'solid-js';
import { A } from '@solidjs/router';
import { libraryStore } from '../stores/libraryStore';
import {
  onGenerationProgress,
  onGenerationComplete,
  onGenerationError,
  EventSubscriptionManager,
} from '../tauri/events';
import { cancelGeneration } from '../tauri/commands';
import type { BookId, GenerationStage, Book } from '../types';

interface ProcessingBook {
  bookId: BookId;
  title: string;
  stage: GenerationStage;
  current: number;
  total: number;
  message: string;
  error: string | null;
}

const styles = {
  container: {
    padding: '24px',
    'max-width': '800px',
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
  backLink: {
    'font-size': '14px',
    color: 'var(--text-accent)',
    'text-decoration': 'none',
  } as JSX.CSSProperties,
  queue: {
    display: 'flex',
    'flex-direction': 'column',
    gap: '16px',
  } as JSX.CSSProperties,
  card: {
    'background-color': 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    'border-radius': '12px',
    padding: '20px',
  } as JSX.CSSProperties,
  cardHeader: {
    display: 'flex',
    'justify-content': 'space-between',
    'align-items': 'flex-start',
    'margin-bottom': '12px',
  } as JSX.CSSProperties,
  bookTitle: {
    'font-size': '16px',
    'font-weight': '600',
    color: 'var(--text-primary)',
    margin: '0',
  } as JSX.CSSProperties,
  cancelButton: {
    padding: '6px 12px',
    'font-size': '12px',
    'font-weight': '500',
    'background-color': 'transparent',
    color: 'var(--error-color)',
    border: '1px solid var(--error-color)',
    'border-radius': '6px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  } as JSX.CSSProperties,
  stageInfo: {
    display: 'flex',
    'align-items': 'center',
    gap: '8px',
    'margin-bottom': '12px',
  } as JSX.CSSProperties,
  stageBadge: {
    display: 'inline-flex',
    'align-items': 'center',
    padding: '4px 10px',
    'font-size': '12px',
    'font-weight': '500',
    'border-radius': '12px',
    'text-transform': 'capitalize',
  } as JSX.CSSProperties,
  stageMessage: {
    'font-size': '13px',
    color: 'var(--text-secondary)',
  } as JSX.CSSProperties,
  progressBar: {
    width: '100%',
    height: '8px',
    'background-color': 'var(--border-color)',
    'border-radius': '4px',
    overflow: 'hidden',
  } as JSX.CSSProperties,
  progressFill: {
    height: '100%',
    'background-color': 'var(--text-accent)',
    'border-radius': '4px',
    transition: 'width 0.3s ease',
  } as JSX.CSSProperties,
  progressText: {
    'font-size': '12px',
    color: 'var(--text-secondary)',
    'text-align': 'right',
    'margin-top': '4px',
  } as JSX.CSSProperties,
  errorMessage: {
    padding: '12px',
    'background-color': '#fef2f2',
    border: '1px solid #fecaca',
    'border-radius': '8px',
    color: '#dc2626',
    'font-size': '13px',
    'margin-top': '12px',
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
  libraryLink: {
    padding: '10px 20px',
    'font-size': '14px',
    'font-weight': '500',
    'background-color': 'var(--text-accent)',
    color: '#ffffff',
    border: 'none',
    'border-radius': '8px',
    'text-decoration': 'none',
    display: 'inline-block',
    transition: 'opacity 0.2s',
  } as JSX.CSSProperties,
  successToast: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    padding: '16px 20px',
    'background-color': '#10b981',
    color: '#ffffff',
    'border-radius': '8px',
    'box-shadow': '0 4px 12px rgba(0, 0, 0, 0.15)',
    display: 'flex',
    'align-items': 'center',
    gap: '8px',
    'font-size': '14px',
    'font-weight': '500',
  } as JSX.CSSProperties,
};

function getStageStyle(stage: GenerationStage): JSX.CSSProperties {
  const base = styles.stageBadge;
  switch (stage) {
    case 'extracting':
      return { ...base, 'background-color': '#dbeafe', color: '#1d4ed8' };
    case 'captioning':
      return { ...base, 'background-color': '#fef3c7', color: '#b45309' };
    case 'narrating':
      return { ...base, 'background-color': '#d1fae5', color: '#047857' };
    case 'finalizing':
      return { ...base, 'background-color': '#ede9fe', color: '#6d28d9' };
    default:
      return base;
  }
}

function getStageLabel(stage: GenerationStage): string {
  switch (stage) {
    case 'extracting': return 'Extracting';
    case 'captioning': return 'Captioning Images';
    case 'narrating': return 'Generating Narration';
    case 'finalizing': return 'Finalizing';
    default: return stage;
  }
}

export function GeneratorView() {
  const [processingBooks, setProcessingBooks] = createSignal<Map<BookId, ProcessingBook>>(new Map());
  const [successToast, setSuccessToast] = createSignal<{ bookId: BookId; title: string } | null>(null);

  const getBookTitle = (bookId: BookId): string => {
    const book = libraryStore.books().find((b) => b.id === bookId);
    return book?.title ?? 'Unknown Book';
  };

  const handleCancel = async (bookId: BookId) => {
    try {
      await cancelGeneration();
      setProcessingBooks((prev) => {
        const next = new Map(prev);
        next.delete(bookId);
        return next;
      });
    } catch (err) {
      console.error('Failed to cancel generation:', err);
    }
  };

  onMount(() => {
    const manager = new EventSubscriptionManager();

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

    manager.add(
      onGenerationComplete((payload) => {
        const title = getBookTitle(payload.bookId);

        setProcessingBooks((prev) => {
          const next = new Map(prev);
          next.delete(payload.bookId);
          return next;
        });

        const book = libraryStore.books().find((b) => b.id === payload.bookId);
        if (book) {
          const updatedBook: Book = { ...book, narrationStatus: 'ready' };
          libraryStore.updateBook(updatedBook);
        }

        setSuccessToast({ bookId: payload.bookId, title });
        setTimeout(() => setSuccessToast(null), 4000);
      })
    );

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

        const book = libraryStore.books().find((b) => b.id === payload.bookId);
        if (book) {
          const updatedBook: Book = { ...book, narrationStatus: 'none' };
          libraryStore.updateBook(updatedBook);
        }
      })
    );

    onCleanup(() => manager.unlistenAll());
  });

  // Check for books with 'generating' status
  createEffect(() => {
    const generatingBooks = libraryStore.books().filter((b) => b.narrationStatus === 'generating');
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
  });

  const processingList = () => Array.from(processingBooks().values());

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Generator</h1>
        <Show when={processingList().length > 0}>
          <A href="/library" style={styles.backLink}>Back to Library</A>
        </Show>
      </div>

      <Show when={processingList().length === 0}>
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>*</div>
          <h2 style={styles.emptyTitle}>No books processing</h2>
          <p style={styles.emptyText}>
            Generate narration from the Library. Select a book and click "Generate Narration" to add it to the queue.
          </p>
          <A
            href="/library"
            style={styles.libraryLink}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            Go to Library
          </A>
        </div>
      </Show>

      <Show when={processingList().length > 0}>
        <div style={styles.queue}>
          <For each={processingList()}>
            {(item) => {
              const percent = () => item.total > 0 ? Math.round((item.current / item.total) * 100) : 0;

              return (
                <div style={{
                  ...styles.card,
                  ...(item.error ? { 'border-color': 'var(--error-color)' } : {}),
                }}>
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
                    <span style={getStageStyle(item.stage)}>{getStageLabel(item.stage)}</span>
                    <span style={styles.stageMessage}>{item.message}</span>
                  </div>

                  <div style={{ 'margin-bottom': '8px' }}>
                    <div style={styles.progressBar}>
                      <div style={{ ...styles.progressFill, width: `${percent()}%` }} />
                    </div>
                    <div style={styles.progressText}>{percent()}%</div>
                  </div>

                  <Show when={item.error}>
                    <div style={styles.errorMessage}>{item.error}</div>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </Show>

      <Show when={successToast()}>
        <div style={styles.successToast}>
          <span>Narration complete: {successToast()!.title}</span>
        </div>
      </Show>
    </div>
  );
}

export default GeneratorView;
