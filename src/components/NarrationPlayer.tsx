/**
 * NarrationPlayer Component
 *
 * Audio player for narration with synchronized text highlighting.
 * Handles playback controls, progress tracking, and segment navigation.
 *
 * Uses GLOSSARY.md terminology:
 *   - "narration" not "audio"
 *   - "segment" not "paragraph"
 *   - "marker" not "timestamp"
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import type { Marker, Segment, Duration } from '../types';

// =============================================================================
// Props Interface
// =============================================================================

export interface NarrationPlayerProps {
  /** Path to the narration audio file */
  narrationPath: string;
  /** Timing markers for segments */
  markers: Marker[];
  /** Current playback time in seconds */
  currentTime: Duration;
  /** Whether narration is playing */
  isPlaying: boolean;
  /** Playback speed multiplier */
  playbackSpeed: number;
  /** Callback when time updates */
  onTimeUpdate: (time: Duration) => void;
  /** Callback when playing state changes */
  onPlayingChange: (playing: boolean) => void;
  /** Callback to seek to a specific segment */
  onSeekToSegment: (index: number) => void;
  /** All segments for navigation */
  segments: Segment[];
  /** Current segment index */
  currentSegmentIndex: number;
}

// =============================================================================
// Styles
// =============================================================================

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '16px 24px',
    backgroundColor: 'var(--bg-secondary)',
    borderTop: '1px solid var(--border-color)',
    gap: '12px',
  },
  progressContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  progressBar: {
    flex: 1,
    height: '6px',
    backgroundColor: 'var(--border-color)',
    borderRadius: '3px',
    cursor: 'pointer',
    position: 'relative' as const,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'var(--text-accent)',
    borderRadius: '3px',
    transition: 'width 0.1s linear',
  },
  time: {
    fontSize: '12px',
    fontFamily: 'monospace',
    color: 'var(--text-secondary)',
    minWidth: '45px',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  controlButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: '18px',
    color: 'var(--text-primary)',
    transition: 'background-color 0.2s',
  },
  playButton: {
    width: '48px',
    height: '48px',
    backgroundColor: 'var(--text-accent)',
    color: '#ffffff',
    fontSize: '20px',
  },
  speedButton: {
    fontSize: '12px',
    fontWeight: 600,
    width: 'auto',
    padding: '0 12px',
    borderRadius: '16px',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
  },
  segmentInfo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  segmentText: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format duration in seconds to MM:SS
 */
function formatTime(seconds: Duration): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format duration to HH:MM:SS if over an hour
 */
function formatLongTime(seconds: Duration): string {
  if (seconds < 3600) {
    return formatTime(seconds);
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// =============================================================================
// Speed Options
// =============================================================================

const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

// =============================================================================
// Component
// =============================================================================

export function NarrationPlayer({
  narrationPath,
  markers,
  currentTime,
  isPlaying,
  playbackSpeed,
  onTimeUpdate,
  onPlayingChange,
  onSeekToSegment,
  segments,
  currentSegmentIndex,
}: NarrationPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  // Calculate total duration from markers - derived from props, not state
  const duration = markers.length > 0 ? markers[markers.length - 1].end : 0;

  // Sync audio element with state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play().catch(console.error);
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  // Sync playback speed
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Sync audio position when segment index changes externally (e.g., from clicking a segment)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || segments.length === 0) return;

    // Find the marker for the current segment
    const currentSegment = segments[currentSegmentIndex];
    if (!currentSegment) return;

    const marker = markers.find((m) => m.segmentId === currentSegment.id);
    if (marker) {
      // Only seek if we're not already at this position (to avoid infinite loops)
      const diff = Math.abs(audio.currentTime - marker.start);
      if (diff > 0.5) {
        audio.currentTime = marker.start;
      }
    }
  }, [currentSegmentIndex, segments, markers]);

  // Handle time update from audio element
  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      onTimeUpdate(audio.currentTime);
    }
  }, [onTimeUpdate]);

  // Handle loaded metadata - duration is derived from markers,
  // so we don't need to track it from the audio element
  const handleLoadedMetadata = useCallback(() => {
    // Duration is already calculated from markers
  }, []);

  // Handle audio ended
  const handleEnded = useCallback(() => {
    onPlayingChange(false);
  }, [onPlayingChange]);

  // Handle play/pause click
  const handlePlayPause = useCallback(() => {
    onPlayingChange(!isPlaying);
  }, [isPlaying, onPlayingChange]);

  // Handle previous segment
  const handlePrevious = useCallback(() => {
    if (currentSegmentIndex > 0) {
      onSeekToSegment(currentSegmentIndex - 1);
      // Also seek audio to segment start
      const prevSegment = segments[currentSegmentIndex - 1];
      const marker = markers.find((m) => m.segmentId === prevSegment?.id);
      if (marker && audioRef.current) {
        audioRef.current.currentTime = marker.start;
      }
    }
  }, [currentSegmentIndex, onSeekToSegment, segments, markers]);

  // Handle next segment
  const handleNext = useCallback(() => {
    if (currentSegmentIndex < segments.length - 1) {
      onSeekToSegment(currentSegmentIndex + 1);
      // Also seek audio to segment start
      const nextSegment = segments[currentSegmentIndex + 1];
      const marker = markers.find((m) => m.segmentId === nextSegment?.id);
      if (marker && audioRef.current) {
        audioRef.current.currentTime = marker.start;
      }
    }
  }, [currentSegmentIndex, segments, onSeekToSegment, markers]);

  // Handle skip backward 10s
  const handleSkipBack = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = Math.max(0, audio.currentTime - 10);
    }
  }, []);

  // Handle skip forward 10s
  const handleSkipForward = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = Math.min(duration, audio.currentTime + 10);
    }
  }, [duration]);

  // Handle progress bar click
  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const newTime = percent * duration;

    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
    onTimeUpdate(newTime);
  }, [duration, onTimeUpdate]);

  // Handle speed change
  const handleSpeedChange = useCallback((speed: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
    setShowSpeedMenu(false);
    // Note: The parent component should update playbackSpeed in settings
  }, []);

  // Calculate progress percentage
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not focused on an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          handlePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleSkipBack();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleSkipForward();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePlayPause, handleSkipBack, handleSkipForward]);

  return (
    <div style={styles.container}>
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={narrationPath}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      {/* Progress bar */}
      <div style={styles.progressContainer}>
        <span style={styles.time}>{formatLongTime(currentTime)}</span>
        <div style={styles.progressBar} onClick={handleProgressClick}>
          <div
            style={{
              ...styles.progressFill,
              width: `${progressPercent}%`,
            }}
          />
        </div>
        <span style={styles.time}>{formatLongTime(duration)}</span>
      </div>

      {/* Controls */}
      <div style={styles.controls}>
        {/* Speed button */}
        <div style={{ position: 'relative' }}>
          <button
            style={{ ...styles.controlButton, ...styles.speedButton }}
            onClick={() => setShowSpeedMenu(!showSpeedMenu)}
            title="Playback speed"
          >
            {playbackSpeed}x
          </button>
          {showSpeedMenu && (
            <div
              style={{
                position: 'absolute',
                bottom: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '4px',
                marginBottom: '8px',
                zIndex: 10,
              }}
            >
              {speedOptions.map((speed) => (
                <button
                  key={speed}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 16px',
                    backgroundColor: speed === playbackSpeed ? 'var(--bg-accent)' : 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: 'var(--text-primary)',
                    textAlign: 'left' as const,
                  }}
                  onClick={() => handleSpeedChange(speed)}
                >
                  {speed}x
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Previous segment */}
        <button
          style={styles.controlButton}
          onClick={handlePrevious}
          disabled={currentSegmentIndex === 0}
          title="Previous segment"
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          ⏮
        </button>

        {/* Skip back 10s */}
        <button
          style={styles.controlButton}
          onClick={handleSkipBack}
          title="Skip back 10 seconds"
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          ⏪
        </button>

        {/* Play/Pause */}
        <button
          style={{ ...styles.controlButton, ...styles.playButton }}
          onClick={handlePlayPause}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        {/* Skip forward 10s */}
        <button
          style={styles.controlButton}
          onClick={handleSkipForward}
          title="Skip forward 10 seconds"
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          ⏩
        </button>

        {/* Next segment */}
        <button
          style={styles.controlButton}
          onClick={handleNext}
          disabled={currentSegmentIndex >= segments.length - 1}
          title="Next segment"
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          ⏭
        </button>
      </div>

      {/* Segment info */}
      <div style={styles.segmentInfo}>
        <span style={styles.segmentText}>
          Segment {currentSegmentIndex + 1} of {segments.length}
        </span>
      </div>
    </div>
  );
}

export default NarrationPlayer;
