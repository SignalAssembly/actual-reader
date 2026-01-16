/**
 * ReaderView Component
 *
 * Displays book content with synchronized narration player.
 * Handles segment highlighting during playback.
 *
 * Uses GLOSSARY.md terminology:
 *   - "segment" not "paragraph"
 *   - "marker" not "timestamp"
 *   - "narration" not "audio"
 *
 * Note: HTML content is rendered using dangerouslySetInnerHTML for parsed book content.
 * The backend parser is responsible for sanitizing HTML during import.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useReaderStore, selectHasNarration } from '../stores/readerStore';
import { useSettingsStore } from '../stores/settingsStore';
import { NarrationPlayer } from '../components/NarrationPlayer';
import type { Segment } from '../types';

// =============================================================================
// Styles
// =============================================================================

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100vh',
    backgroundColor: 'var(--bg-primary)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 24px',
    borderBottom: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    fontSize: '14px',
    fontWeight: 500,
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  titleContainer: {
    flex: 1,
    textAlign: 'center' as const,
    padding: '0 16px',
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  author: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    margin: '4px 0 0 0',
  },
  headerActions: {
    display: 'flex',
    gap: '8px',
  },
  actionButton: {
    padding: '8px 12px',
    fontSize: '14px',
    fontWeight: 500,
    backgroundColor: 'var(--bg-accent)',
    color: 'var(--text-accent)',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '32px',
  },
  contentInner: {
    maxWidth: '720px',
    margin: '0 auto',
  },
  segment: {
    padding: '8px 12px',
    margin: '0 -12px',
    borderRadius: '4px',
    lineHeight: 1.8,
    transition: 'background-color 0.2s',
    cursor: 'pointer',
  },
  imageSegment: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '16px 12px',
    margin: '16px -12px',
  },
  segmentImage: {
    maxWidth: '100%',
    maxHeight: '400px',
    borderRadius: '8px',
  },
  imageCaption: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    fontStyle: 'italic' as const,
    marginTop: '8px',
    textAlign: 'center' as const,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--text-secondary)',
  },
  error: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--error-color)',
    textAlign: 'center' as const,
    padding: '24px',
  },
};

// =============================================================================
// Component
// =============================================================================

export function ReaderView() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();

  const {
    currentBook,
    segments,
    markers,
    currentSegmentIndex,
    currentTime,
    isPlaying,
    loading,
    error,
    loadBook,
    unloadBook,
    setSegmentIndex,
    setCurrentTime,
    setPlaying,
  } = useReaderStore();

  const hasNarration = useReaderStore(selectHasNarration);

  const { fontSize, fontFamily, lineHeight, highlightColor, playbackSpeed } = useSettingsStore();

  const contentRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Load book on mount
  useEffect(() => {
    if (bookId) {
      loadBook(bookId).catch(console.error);
    }

    return () => {
      unloadBook();
    };
  }, [bookId, loadBook, unloadBook]);

  // Scroll to current segment when it changes
  useEffect(() => {
    const segmentEl = segmentRefs.current.get(currentSegmentIndex);
    if (segmentEl && contentRef.current) {
      segmentEl.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentSegmentIndex]);

  // Handle segment click
  const handleSegmentClick = useCallback((index: number) => {
    setSegmentIndex(index);
  }, [setSegmentIndex]);

  // Handle back button
  const handleBack = useCallback(() => {
    navigate('/library');
  }, [navigate]);

  // Render segment content safely
  const renderSegmentContent = useCallback((segment: Segment) => {
    if (segment.html) {
      // HTML content from parsed books (sanitized by backend parser)
      return <span dangerouslySetInnerHTML={{ __html: segment.html }} />;
    }
    return <span>{segment.content}</span>;
  }, []);

  // Render segment
  const renderSegment = useCallback((segment: Segment, index: number) => {
    const isHighlighted = index === currentSegmentIndex;

    // Handle image segments
    if (segment.segmentType === 'image' && segment.imageData) {
      return (
        <div
          key={segment.id}
          ref={(el) => {
            if (el) segmentRefs.current.set(index, el);
          }}
          style={{
            ...styles.imageSegment,
            ...(isHighlighted ? { backgroundColor: highlightColor } : {}),
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

    // Handle text segments
    return (
      <div
        key={segment.id}
        ref={(el) => {
          if (el) segmentRefs.current.set(index, el);
        }}
        style={{
          ...styles.segment,
          fontSize: `${fontSize}px`,
          fontFamily: fontFamily === 'system' ? 'inherit' : fontFamily,
          lineHeight,
          ...(isHighlighted ? { backgroundColor: highlightColor } : {}),
        }}
        onClick={() => handleSegmentClick(index)}
      >
        {renderSegmentContent(segment)}
      </div>
    );
  }, [currentSegmentIndex, fontSize, fontFamily, lineHeight, highlightColor, handleSegmentClick, renderSegmentContent]);

  // Loading state
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading book...</div>
      </div>
    );
  }

  // Error state
  if (error || !currentBook) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button
            style={styles.backButton}
            onClick={handleBack}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-accent)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            Back
          </button>
        </div>
        <div style={styles.error}>
          <p>{error || 'Book not found'}</p>
          <button style={styles.actionButton} onClick={handleBack}>
            Return to Library
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
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
          <h1 style={styles.title}>{currentBook.title}</h1>
          {currentBook.author && (
            <p style={styles.author}>{currentBook.author}</p>
          )}
        </div>

        <div style={styles.headerActions}>
          {/* Placeholder for future actions like export, settings */}
        </div>
      </header>

      {/* Content */}
      <div style={styles.content} ref={contentRef}>
        <div style={styles.contentInner}>
          {/* Segments */}
          {segments.map((segment, index) => renderSegment(segment, index))}
        </div>
      </div>

      {/* Narration Player */}
      {hasNarration && currentBook.narrationPath && (
        <NarrationPlayer
          narrationPath={currentBook.narrationPath}
          markers={markers}
          currentTime={currentTime}
          isPlaying={isPlaying}
          playbackSpeed={playbackSpeed}
          onTimeUpdate={setCurrentTime}
          onPlayingChange={setPlaying}
          onSeekToSegment={setSegmentIndex}
          segments={segments}
          currentSegmentIndex={currentSegmentIndex}
        />
      )}
    </div>
  );
}

export default ReaderView;
