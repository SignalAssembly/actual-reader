/**
 * ReaderView Component (Solid)
 */

import { createEffect, onMount, onCleanup, For, Show, type JSX } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { readerStore } from '../stores/readerStore';
import { settingsStore } from '../stores/settingsStore';
import { NarrationPlayer } from '../components/NarrationPlayer';
import type { Segment } from '../types';

const styles = {
  container: {
    display: 'flex',
    'flex-direction': 'column',
    height: '100vh',
    'background-color': 'var(--bg-primary)',
  } as JSX.CSSProperties,
  header: {
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'space-between',
    padding: '12px 24px',
    'border-bottom': '1px solid var(--border-color)',
    'background-color': 'var(--bg-secondary)',
    'flex-shrink': '0',
  } as JSX.CSSProperties,
  backButton: {
    display: 'flex',
    'align-items': 'center',
    gap: '8px',
    padding: '8px 12px',
    'font-size': '14px',
    'font-weight': '500',
    'background-color': 'transparent',
    color: 'var(--text-secondary)',
    border: 'none',
    'border-radius': '6px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  } as JSX.CSSProperties,
  titleContainer: {
    flex: '1',
    'text-align': 'center',
    padding: '0 16px',
  } as JSX.CSSProperties,
  title: {
    'font-size': '16px',
    'font-weight': '600',
    color: 'var(--text-primary)',
    margin: '0',
    overflow: 'hidden',
    'text-overflow': 'ellipsis',
    'white-space': 'nowrap',
  } as JSX.CSSProperties,
  author: {
    'font-size': '12px',
    color: 'var(--text-secondary)',
    margin: '4px 0 0 0',
  } as JSX.CSSProperties,
  content: {
    flex: '1',
    overflow: 'auto',
    padding: '32px',
  } as JSX.CSSProperties,
  contentInner: {
    'max-width': '720px',
    margin: '0 auto',
  } as JSX.CSSProperties,
  segment: {
    padding: '8px 12px',
    margin: '0 -12px',
    'border-radius': '4px',
    'line-height': '1.8',
    transition: 'background-color 0.2s',
    cursor: 'pointer',
  } as JSX.CSSProperties,
  imageSegment: {
    display: 'flex',
    'flex-direction': 'column',
    'align-items': 'center',
    padding: '16px 12px',
    margin: '16px -12px',
  } as JSX.CSSProperties,
  segmentImage: {
    'max-width': '100%',
    'max-height': '400px',
    'border-radius': '8px',
  } as JSX.CSSProperties,
  imageCaption: {
    'font-size': '14px',
    color: 'var(--text-secondary)',
    'font-style': 'italic',
    'margin-top': '8px',
    'text-align': 'center',
  } as JSX.CSSProperties,
  loading: {
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'center',
    height: '100%',
    color: 'var(--text-secondary)',
  } as JSX.CSSProperties,
  error: {
    display: 'flex',
    'flex-direction': 'column',
    'align-items': 'center',
    'justify-content': 'center',
    height: '100%',
    color: 'var(--error-color)',
    'text-align': 'center',
    padding: '24px',
  } as JSX.CSSProperties,
  actionButton: {
    padding: '8px 12px',
    'font-size': '14px',
    'font-weight': '500',
    'background-color': 'var(--bg-accent)',
    color: 'var(--text-accent)',
    border: 'none',
    'border-radius': '6px',
    cursor: 'pointer',
  } as JSX.CSSProperties,
};

export function ReaderView() {
  const params = useParams<{ bookId: string }>();
  const navigate = useNavigate();

  let contentRef: HTMLDivElement | undefined;
  const segmentRefs = new Map<number, HTMLDivElement>();

  onMount(() => {
    if (params.bookId) {
      readerStore.loadBook(params.bookId).catch(console.error);
    }
  });

  onCleanup(() => {
    readerStore.unloadBook();
  });

  // Scroll to current segment when it changes
  createEffect(() => {
    const segmentEl = segmentRefs.get(readerStore.currentSegmentIndex());
    if (segmentEl && contentRef) {
      segmentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  const handleSegmentClick = (index: number) => {
    readerStore.setSegmentIndex(index);
  };

  const handleBack = () => navigate('/library');

  const renderSegmentContent = (segment: Segment) => {
    if (segment.html) {
      return <span innerHTML={segment.html} />;
    }
    return <span>{segment.content}</span>;
  };

  const renderSegment = (segment: Segment, index: number) => {
    const isHighlighted = () => index === readerStore.currentSegmentIndex();

    if (segment.segmentType === 'image' && segment.imageData) {
      return (
        <div
          ref={(el) => segmentRefs.set(index, el)}
          style={{
            ...styles.imageSegment,
            ...(isHighlighted() ? { 'background-color': settingsStore.highlightColor() } : {}),
          }}
          onClick={() => handleSegmentClick(index)}
        >
          <img
            src={segment.imageData.sourcePath}
            alt={segment.imageData.altText || 'Book image'}
            style={styles.segmentImage}
          />
          {segment.imageData.caption && (
            <p style={styles.imageCaption}>{segment.imageData.caption}</p>
          )}
        </div>
      );
    }

    return (
      <div
        ref={(el) => segmentRefs.set(index, el)}
        style={{
          ...styles.segment,
          'font-size': `${settingsStore.fontSize()}px`,
          'font-family': settingsStore.fontFamily() === 'system' ? 'inherit' : settingsStore.fontFamily(),
          'line-height': String(settingsStore.lineHeight()),
          ...(isHighlighted() ? { 'background-color': settingsStore.highlightColor() } : {}),
        }}
        onClick={() => handleSegmentClick(index)}
      >
        {renderSegmentContent(segment)}
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <Show when={readerStore.loading()}>
        <div style={styles.loading}>Loading book...</div>
      </Show>

      <Show when={!readerStore.loading() && (readerStore.error() || !readerStore.currentBook())}>
        <header style={styles.header}>
          <button
            style={styles.backButton}
            onClick={handleBack}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-accent)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            Back
          </button>
        </header>
        <div style={styles.error}>
          <p>{readerStore.error() || 'Book not found'}</p>
          <button style={styles.actionButton} onClick={handleBack}>
            Return to Library
          </button>
        </div>
      </Show>

      <Show when={!readerStore.loading() && readerStore.currentBook()}>
        <header style={styles.header}>
          <button
            style={styles.backButton}
            onClick={handleBack}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-accent)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            Back
          </button>

          <div style={styles.titleContainer}>
            <h1 style={styles.title}>{readerStore.currentBook()!.title}</h1>
            {readerStore.currentBook()!.author && (
              <p style={styles.author}>{readerStore.currentBook()!.author}</p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }} />
        </header>

        <div style={styles.content} ref={contentRef}>
          <div style={styles.contentInner}>
            <For each={readerStore.segments()}>
              {(segment, index) => renderSegment(segment, index())}
            </For>
          </div>
        </div>

        <Show when={readerStore.hasNarration() && readerStore.currentBook()?.narrationPath}>
          <NarrationPlayer
            narrationPath={readerStore.currentBook()!.narrationPath!}
            markers={readerStore.markers()}
            currentTime={readerStore.currentTime()}
            isPlaying={readerStore.isPlaying()}
            playbackSpeed={settingsStore.playbackSpeed()}
            onTimeUpdate={readerStore.setCurrentTime}
            onPlayingChange={readerStore.setPlaying}
            onSeekToSegment={readerStore.setSegmentIndex}
            segments={readerStore.segments()}
            currentSegmentIndex={readerStore.currentSegmentIndex()}
          />
        </Show>
      </Show>
    </div>
  );
}

export default ReaderView;
