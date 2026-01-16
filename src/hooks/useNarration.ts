/**
 * React hook for narration generation state management
 *
 * Manages the state of narration generation, listens to backend events,
 * and provides methods to start/cancel generation.
 *
 * Uses GLOSSARY.md terminology: "narration" not "audio", "generation" not "processing"
 */

import { useState, useEffect, useCallback } from 'react';
import { useLibraryStore } from '../stores/libraryStore';
import {
  EventSubscriptionManager,
  onGenerationProgress,
  onGenerationComplete,
  onGenerationError,
} from '../tauri/events';
import * as commands from '../tauri/commands';
import type {
  BookId,
  VoiceId,
  Voice,
  GenerationProgressPayload,
  GenerationStage,
} from '../types';

// =============================================================================
// Types
// =============================================================================

interface NarrationProgress {
  bookId: BookId;
  stage: GenerationStage;
  current: number;
  total: number;
  message: string;
  /** Calculated percentage (0-100) */
  percent: number;
}

interface UseNarrationReturn {
  /** Whether narration is currently being generated */
  isGenerating: boolean;
  /** Current generation progress, null if not generating */
  progress: NarrationProgress | null;
  /** Error from last failed generation */
  error: string | null;
  /** Available voices for generation */
  voices: Voice[];
  /** Start generating narration for a book */
  generateNarration: (bookId: BookId, voiceId: VoiceId) => Promise<void>;
  /** Cancel ongoing generation */
  cancelGeneration: () => Promise<void>;
  /** Fetch available voices */
  refreshVoices: () => Promise<void>;
  /** Clear any error state */
  clearError: () => void;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook for managing narration generation
 *
 * Automatically subscribes to generation events from the backend
 * and cleans up on unmount.
 *
 * @example
 * ```tsx
 * function GeneratorView() {
 *   const {
 *     isGenerating,
 *     progress,
 *     error,
 *     voices,
 *     generateNarration,
 *     cancelGeneration
 *   } = useNarration();
 *
 *   const handleGenerate = async () => {
 *     await generateNarration(bookId, selectedVoiceId);
 *   };
 *
 *   if (isGenerating && progress) {
 *     return (
 *       <div>
 *         <p>Stage: {progress.stage}</p>
 *         <ProgressBar value={progress.percent} />
 *         <button onClick={cancelGeneration}>Cancel</button>
 *       </div>
 *     );
 *   }
 *
 *   return <button onClick={handleGenerate}>Generate Narration</button>;
 * }
 * ```
 */
export function useNarration(): UseNarrationReturn {
  // Local state
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<NarrationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);

  // Access library store for updating book status after generation
  const fetchLibrary = useLibraryStore((state) => state.fetchLibrary);

  // Subscribe to backend events
  useEffect(() => {
    const manager = new EventSubscriptionManager();

    // Set up event listeners
    const setupListeners = async () => {
      // Progress updates
      await manager.add(
        onGenerationProgress((payload: GenerationProgressPayload) => {
          const percent = payload.total > 0
            ? Math.round((payload.current / payload.total) * 100)
            : 0;

          setProgress({
            bookId: payload.bookId,
            stage: payload.stage,
            current: payload.current,
            total: payload.total,
            message: payload.message,
            percent,
          });
          setIsGenerating(true);
          setError(null);
        })
      );

      // Generation complete
      await manager.add(
        onGenerationComplete(() => {
          setIsGenerating(false);
          setProgress(null);
          // Refresh library to update book's narration status
          fetchLibrary();
        })
      );

      // Generation error
      await manager.add(
        onGenerationError((payload) => {
          setError(payload.error);
          setIsGenerating(false);
          setProgress(null);
        })
      );
    };

    setupListeners();

    // Cleanup on unmount
    return () => {
      manager.unlistenAll();
    };
  }, [fetchLibrary]);

  // Fetch voices on mount
  useEffect(() => {
    refreshVoicesInternal();
  }, []);

  // Internal function to fetch voices
  const refreshVoicesInternal = async () => {
    try {
      const fetchedVoices = await commands.getVoices();
      setVoices(fetchedVoices);
    } catch (err) {
      // Voices may not be available (e.g., on mobile)
      // This is expected, so we don't set an error
      console.warn('Failed to fetch voices:', err);
    }
  };

  // Start generating narration
  const generateNarration = useCallback(
    async (bookId: BookId, voiceId: VoiceId): Promise<void> => {
      setError(null);
      setIsGenerating(true);
      setProgress({
        bookId,
        stage: 'extracting',
        current: 0,
        total: 100,
        message: 'Starting generation...',
        percent: 0,
      });

      try {
        await commands.generateNarration(bookId, voiceId);
        // Note: actual completion is handled by the event listener
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to start generation';
        setError(message);
        setIsGenerating(false);
        setProgress(null);
        throw err;
      }
    },
    []
  );

  // Cancel ongoing generation
  const cancelGeneration = useCallback(async (): Promise<void> => {
    try {
      await commands.cancelGeneration();
      setIsGenerating(false);
      setProgress(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel generation';
      setError(message);
      throw err;
    }
  }, []);

  // Refresh voices
  const refreshVoices = useCallback(async (): Promise<void> => {
    await refreshVoicesInternal();
  }, []);

  // Clear error
  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  return {
    isGenerating,
    progress,
    error,
    voices,
    generateNarration,
    cancelGeneration,
    refreshVoices,
    clearError,
  };
}
