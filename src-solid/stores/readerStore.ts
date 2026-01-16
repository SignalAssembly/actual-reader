/**
 * Solid store for reader state management
 */

import { createSignal, createMemo, createRoot } from 'solid-js';
import type { Book, BookId, Segment, Marker, Progress, Duration } from '../types';
import * as commands from '../tauri/commands';

// =============================================================================
// Store Implementation
// =============================================================================

function createReaderStore() {
  const [currentBook, setCurrentBook] = createSignal<Book | null>(null);
  const [segments, setSegments] = createSignal<Segment[]>([]);
  const [markers, setMarkers] = createSignal<Marker[]>([]);
  const [currentSegmentIndex, setCurrentSegmentIndex] = createSignal(0);
  const [currentTime, setCurrentTime] = createSignal<Duration>(0);
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const loadBook = async (bookId: BookId) => {
    setLoading(true);
    setError(null);
    try {
      const [book, segs, marks, progress] = await Promise.all([
        commands.getBook(bookId),
        commands.getSegments(bookId),
        commands.getMarkers(bookId).catch(() => [] as Marker[]),
        commands.getProgress(bookId).catch(() => null),
      ]);

      const segmentIndex = progress?.segmentIndex ?? 0;
      const time = progress?.audioTime ?? 0;

      setCurrentBook(book);
      setSegments(segs);
      setMarkers(marks);
      setCurrentSegmentIndex(segmentIndex);
      setCurrentTime(time);
      setIsPlaying(false);
      setLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load book';
      setError(message);
      setLoading(false);
      throw err;
    }
  };

  const unloadBook = () => {
    const book = currentBook();
    if (book) {
      saveProgress().catch(console.error);
    }

    setCurrentBook(null);
    setSegments([]);
    setMarkers([]);
    setCurrentSegmentIndex(0);
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const setSegmentIndexWithSync = (index: number) => {
    const segs = segments();
    const marks = markers();
    if (index >= 0 && index < segs.length) {
      setCurrentSegmentIndex(index);
      const segmentId = segs[index]?.id;
      const marker = marks.find((m) => m.segmentId === segmentId);
      if (marker) {
        setCurrentTime(marker.start);
      }
    }
  };

  const setCurrentTimeWithSync = (time: Duration) => {
    setCurrentTime(time);
    const marks = markers();
    const segs = segments();
    if (marks.length > 0) {
      const markerIndex = marks.findIndex(
        (m) => time >= m.start && time < m.end
      );
      if (markerIndex !== -1) {
        const marker = marks[markerIndex];
        const segmentIndex = segs.findIndex((s) => s.id === marker.segmentId);
        if (segmentIndex !== -1 && segmentIndex !== currentSegmentIndex()) {
          setCurrentSegmentIndex(segmentIndex);
        }
      }
    }
  };

  const togglePlaying = () => setIsPlaying((prev) => !prev);

  const saveProgress = async () => {
    const book = currentBook();
    if (!book) return;

    try {
      const progress: Progress = {
        bookId: book.id,
        segmentIndex: currentSegmentIndex(),
        audioTime: currentTime() > 0 ? currentTime() : null,
        updatedAt: Math.floor(Date.now() / 1000),
      };
      await commands.saveProgress(book.id, progress);
    } catch (err) {
      console.error('Failed to save progress:', err);
    }
  };

  const seekToTime = (time: Duration) => {
    const marks = markers();
    const segs = segments();
    const maxTime = marks.length > 0 ? marks[marks.length - 1].end : 0;
    const clampedTime = Math.max(0, Math.min(time, maxTime));

    setCurrentTime(clampedTime);

    const marker = marks.find((m) => clampedTime >= m.start && clampedTime < m.end);
    if (marker) {
      const segmentIndex = segs.findIndex((s) => s.id === marker.segmentId);
      if (segmentIndex !== -1) {
        setCurrentSegmentIndex(segmentIndex);
      }
    }
  };

  const nextSegment = () => {
    const segs = segments();
    const marks = markers();
    const nextIndex = currentSegmentIndex() + 1;

    if (nextIndex < segs.length) {
      setCurrentSegmentIndex(nextIndex);
      const segmentId = segs[nextIndex]?.id;
      const marker = marks.find((m) => m.segmentId === segmentId);
      if (marker) {
        setCurrentTime(marker.start);
      }
    }
  };

  const previousSegment = () => {
    const segs = segments();
    const marks = markers();
    const prevIndex = currentSegmentIndex() - 1;

    if (prevIndex >= 0) {
      setCurrentSegmentIndex(prevIndex);
      const segmentId = segs[prevIndex]?.id;
      const marker = marks.find((m) => m.segmentId === segmentId);
      if (marker) {
        setCurrentTime(marker.start);
      }
    }
  };

  const clearError = () => setError(null);

  // Derived state
  const currentSegment = createMemo(() =>
    segments()[currentSegmentIndex()] ?? null
  );

  const currentMarker = createMemo(() => {
    const segment = segments()[currentSegmentIndex()];
    if (!segment) return null;
    return markers().find((m) => m.segmentId === segment.id) ?? null;
  });

  const hasNarration = createMemo(() =>
    currentBook()?.narrationStatus === 'ready' && markers().length > 0
  );

  const totalDuration = createMemo(() => {
    const marks = markers();
    if (marks.length === 0) return 0;
    return marks[marks.length - 1].end;
  });

  const progressPercent = createMemo(() => {
    const total = totalDuration();
    if (total === 0) return 0;
    return (currentTime() / total) * 100;
  });

  return {
    // State
    currentBook,
    segments,
    markers,
    currentSegmentIndex,
    currentTime,
    isPlaying,
    loading,
    error,
    // Derived
    currentSegment,
    currentMarker,
    hasNarration,
    totalDuration,
    progressPercent,
    // Actions
    loadBook,
    unloadBook,
    setSegmentIndex: setSegmentIndexWithSync,
    setCurrentTime: setCurrentTimeWithSync,
    setPlaying: setIsPlaying,
    togglePlaying,
    saveProgress,
    seekToTime,
    nextSegment,
    previousSegment,
    clearError,
  };
}

// Create singleton store
export const readerStore = createRoot(createReaderStore);
