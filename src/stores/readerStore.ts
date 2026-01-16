/**
 * Zustand store for reader state management
 *
 * Manages the current reading session including book, segments, markers, and playback state.
 * Uses GLOSSARY.md terminology: "segment" not "paragraph", "marker" not "timestamp"
 */

import { create } from 'zustand';
import type { Book, BookId, Segment, Marker, Progress, Duration } from '../types';
import * as commands from '../tauri/commands';

// =============================================================================
// Store Interface
// =============================================================================

interface ReaderState {
  /** Currently loaded book */
  currentBook: Book | null;
  /** Segments for the current book */
  segments: Segment[];
  /** Narration markers for the current book */
  markers: Marker[];
  /** Index of the currently active segment */
  currentSegmentIndex: number;
  /** Current playback time in narration (seconds) */
  currentTime: Duration;
  /** Whether narration is currently playing */
  isPlaying: boolean;
  /** Loading state for async operations */
  loading: boolean;
  /** Error message from last failed operation */
  error: string | null;
}

interface ReaderActions {
  /** Load a book and its segments/markers into the reader */
  loadBook: (bookId: BookId) => Promise<void>;
  /** Unload the current book */
  unloadBook: () => void;
  /** Set the current segment index */
  setSegmentIndex: (index: number) => void;
  /** Set the current playback time */
  setCurrentTime: (time: Duration) => void;
  /** Set the playing state */
  setPlaying: (playing: boolean) => void;
  /** Toggle play/pause */
  togglePlaying: () => void;
  /** Save current progress to backend */
  saveProgress: () => Promise<void>;
  /** Jump to a specific marker/segment by time */
  seekToTime: (time: Duration) => void;
  /** Jump to next segment */
  nextSegment: () => void;
  /** Jump to previous segment */
  previousSegment: () => void;
  /** Clear any error state */
  clearError: () => void;
}

type ReaderStore = ReaderState & ReaderActions;

// =============================================================================
// Store Implementation
// =============================================================================

export const useReaderStore = create<ReaderStore>()((set, get) => ({
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  currentBook: null,
  segments: [],
  markers: [],
  currentSegmentIndex: 0,
  currentTime: 0,
  isPlaying: false,
  loading: false,
  error: null,

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  loadBook: async (bookId: BookId) => {
    set({ loading: true, error: null });
    try {
      // Fetch book, segments, markers, and progress in parallel
      const [book, segments, markers, progress] = await Promise.all([
        commands.getBook(bookId),
        commands.getSegments(bookId),
        commands.getMarkers(bookId).catch(() => [] as Marker[]), // Markers may not exist yet
        commands.getProgress(bookId).catch(() => null),
      ]);

      // Restore progress if available
      const segmentIndex = progress?.segmentIndex ?? 0;
      const currentTime = progress?.audioTime ?? 0;

      set({
        currentBook: book,
        segments,
        markers,
        currentSegmentIndex: segmentIndex,
        currentTime,
        isPlaying: false,
        loading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load book';
      set({ error: message, loading: false });
      throw err;
    }
  },

  unloadBook: () => {
    // Save progress before unloading
    const state = get();
    if (state.currentBook) {
      state.saveProgress().catch(console.error);
    }

    set({
      currentBook: null,
      segments: [],
      markers: [],
      currentSegmentIndex: 0,
      currentTime: 0,
      isPlaying: false,
    });
  },

  setSegmentIndex: (index: number) => {
    const { segments, markers } = get();
    if (index >= 0 && index < segments.length) {
      set({ currentSegmentIndex: index });

      // If we have markers, also update currentTime to the start of this segment
      const segmentId = segments[index]?.id;
      const marker = markers.find((m) => m.segmentId === segmentId);
      if (marker) {
        set({ currentTime: marker.start });
      }
    }
  },

  setCurrentTime: (time: Duration) => {
    set({ currentTime: time });

    // Update segment index based on time
    const { markers, segments } = get();
    if (markers.length > 0) {
      // Find the marker that contains this time
      const markerIndex = markers.findIndex(
        (m) => time >= m.start && time < m.end
      );
      if (markerIndex !== -1) {
        const marker = markers[markerIndex];
        const segmentIndex = segments.findIndex((s) => s.id === marker.segmentId);
        if (segmentIndex !== -1 && segmentIndex !== get().currentSegmentIndex) {
          set({ currentSegmentIndex: segmentIndex });
        }
      }
    }
  },

  setPlaying: (playing: boolean) => {
    set({ isPlaying: playing });
  },

  togglePlaying: () => {
    set((state) => ({ isPlaying: !state.isPlaying }));
  },

  saveProgress: async () => {
    const { currentBook, currentSegmentIndex, currentTime } = get();
    if (!currentBook) return;

    try {
      const progress: Progress = {
        bookId: currentBook.id,
        segmentIndex: currentSegmentIndex,
        audioTime: currentTime > 0 ? currentTime : null,
        updatedAt: Math.floor(Date.now() / 1000),
      };
      await commands.saveProgress(currentBook.id, progress);
    } catch (err) {
      console.error('Failed to save progress:', err);
      // Don't throw - progress saving should not interrupt the user
    }
  },

  seekToTime: (time: Duration) => {
    const { markers, segments } = get();

    // Clamp time to valid range
    const maxTime = markers.length > 0 ? markers[markers.length - 1].end : 0;
    const clampedTime = Math.max(0, Math.min(time, maxTime));

    set({ currentTime: clampedTime });

    // Find and set the corresponding segment
    const marker = markers.find((m) => clampedTime >= m.start && clampedTime < m.end);
    if (marker) {
      const segmentIndex = segments.findIndex((s) => s.id === marker.segmentId);
      if (segmentIndex !== -1) {
        set({ currentSegmentIndex: segmentIndex });
      }
    }
  },

  nextSegment: () => {
    const { currentSegmentIndex, segments, markers } = get();
    const nextIndex = currentSegmentIndex + 1;

    if (nextIndex < segments.length) {
      set({ currentSegmentIndex: nextIndex });

      // Update time to start of next segment
      const segmentId = segments[nextIndex]?.id;
      const marker = markers.find((m) => m.segmentId === segmentId);
      if (marker) {
        set({ currentTime: marker.start });
      }
    }
  },

  previousSegment: () => {
    const { currentSegmentIndex, segments, markers } = get();
    const prevIndex = currentSegmentIndex - 1;

    if (prevIndex >= 0) {
      set({ currentSegmentIndex: prevIndex });

      // Update time to start of previous segment
      const segmentId = segments[prevIndex]?.id;
      const marker = markers.find((m) => m.segmentId === segmentId);
      if (marker) {
        set({ currentTime: marker.start });
      }
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));

// =============================================================================
// Selectors
// =============================================================================

/**
 * Select the current segment
 */
export const selectCurrentSegment = (state: ReaderStore): Segment | null => {
  return state.segments[state.currentSegmentIndex] ?? null;
};

/**
 * Select the marker for the current segment
 */
export const selectCurrentMarker = (state: ReaderStore): Marker | null => {
  const segment = state.segments[state.currentSegmentIndex];
  if (!segment) return null;
  return state.markers.find((m) => m.segmentId === segment.id) ?? null;
};

/**
 * Select whether the book has narration available
 */
export const selectHasNarration = (state: ReaderStore): boolean => {
  return state.currentBook?.narrationStatus === 'ready' && state.markers.length > 0;
};

/**
 * Select total narration duration
 */
export const selectTotalDuration = (state: ReaderStore): Duration => {
  if (state.markers.length === 0) return 0;
  return state.markers[state.markers.length - 1].end;
};

/**
 * Select progress as a percentage (0-100)
 */
export const selectProgressPercent = (state: ReaderStore): number => {
  const total = selectTotalDuration(state);
  if (total === 0) return 0;
  return (state.currentTime / total) * 100;
};

/**
 * Select segment progress as a percentage (0-100)
 */
export const selectSegmentProgressPercent = (state: ReaderStore): number => {
  if (state.segments.length === 0) return 0;
  return ((state.currentSegmentIndex + 1) / state.segments.length) * 100;
};
