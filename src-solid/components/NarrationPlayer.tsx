/**
 * NarrationPlayer Component (Solid)
 */

import { createSignal, createEffect, onMount, onCleanup, type JSX } from 'solid-js';
import type { Marker, Segment, Duration } from '../types';

export interface NarrationPlayerProps {
  narrationPath: string;
  markers: Marker[];
  currentTime: Duration;
  isPlaying: boolean;
  playbackSpeed: number;
  onTimeUpdate: (time: Duration) => void;
  onPlayingChange: (playing: boolean) => void;
  onSeekToSegment: (index: number) => void;
  segments: Segment[];
  currentSegmentIndex: number;
}

const styles = {
  container: {
    display: 'flex',
    'flex-direction': 'column',
    padding: '16px 24px',
    'background-color': 'var(--bg-secondary)',
    'border-top': '1px solid var(--border-color)',
    gap: '12px',
  } as JSX.CSSProperties,
  progressContainer: {
    display: 'flex',
    'align-items': 'center',
    gap: '12px',
  } as JSX.CSSProperties,
  progressBar: {
    flex: '1',
    height: '6px',
    'background-color': 'var(--border-color)',
    'border-radius': '3px',
    cursor: 'pointer',
    position: 'relative',
    overflow: 'hidden',
  } as JSX.CSSProperties,
  progressFill: {
    height: '100%',
    'background-color': 'var(--text-accent)',
    'border-radius': '3px',
    transition: 'width 0.1s linear',
  } as JSX.CSSProperties,
  time: {
    'font-size': '12px',
    'font-family': 'monospace',
    color: 'var(--text-secondary)',
    'min-width': '45px',
  } as JSX.CSSProperties,
  controls: {
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'center',
    gap: '8px',
  } as JSX.CSSProperties,
  controlButton: {
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'center',
    width: '40px',
    height: '40px',
    'background-color': 'transparent',
    border: 'none',
    'border-radius': '50%',
    cursor: 'pointer',
    'font-size': '18px',
    color: 'var(--text-primary)',
    transition: 'background-color 0.2s',
  } as JSX.CSSProperties,
  playButton: {
    width: '48px',
    height: '48px',
    'background-color': 'var(--text-accent)',
    color: '#ffffff',
    'font-size': '20px',
  } as JSX.CSSProperties,
  speedButton: {
    'font-size': '12px',
    'font-weight': '600',
    width: 'auto',
    padding: '0 12px',
    'border-radius': '16px',
    'background-color': 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
  } as JSX.CSSProperties,
  segmentInfo: {
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'space-between',
  } as JSX.CSSProperties,
  segmentText: {
    'font-size': '12px',
    color: 'var(--text-secondary)',
  } as JSX.CSSProperties,
};

const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

function formatTime(seconds: Duration): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatLongTime(seconds: Duration): string {
  if (seconds < 3600) return formatTime(seconds);
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function NarrationPlayer(props: NarrationPlayerProps) {
  let audioRef: HTMLAudioElement | undefined;
  const [showSpeedMenu, setShowSpeedMenu] = createSignal(false);

  const duration = () => props.markers.length > 0 ? props.markers[props.markers.length - 1].end : 0;
  const progressPercent = () => duration() > 0 ? (props.currentTime / duration()) * 100 : 0;

  // Sync audio element with playing state
  createEffect(() => {
    if (!audioRef) return;
    if (props.isPlaying) {
      audioRef.play().catch(console.error);
    } else {
      audioRef.pause();
    }
  });

  // Sync playback speed
  createEffect(() => {
    if (audioRef) {
      audioRef.playbackRate = props.playbackSpeed;
    }
  });

  // Sync audio position when segment index changes
  createEffect(() => {
    if (!audioRef || props.segments.length === 0) return;
    const currentSegment = props.segments[props.currentSegmentIndex];
    if (!currentSegment) return;
    const marker = props.markers.find((m) => m.segmentId === currentSegment.id);
    if (marker) {
      const diff = Math.abs(audioRef.currentTime - marker.start);
      if (diff > 0.5) {
        audioRef.currentTime = marker.start;
      }
    }
  });

  const handleTimeUpdate = () => {
    if (audioRef) {
      props.onTimeUpdate(audioRef.currentTime);
    }
  };

  const handleEnded = () => {
    props.onPlayingChange(false);
  };

  const handlePlayPause = () => {
    props.onPlayingChange(!props.isPlaying);
  };

  const handlePrevious = () => {
    if (props.currentSegmentIndex > 0) {
      props.onSeekToSegment(props.currentSegmentIndex - 1);
      const prevSegment = props.segments[props.currentSegmentIndex - 1];
      const marker = props.markers.find((m) => m.segmentId === prevSegment?.id);
      if (marker && audioRef) {
        audioRef.currentTime = marker.start;
      }
    }
  };

  const handleNext = () => {
    if (props.currentSegmentIndex < props.segments.length - 1) {
      props.onSeekToSegment(props.currentSegmentIndex + 1);
      const nextSegment = props.segments[props.currentSegmentIndex + 1];
      const marker = props.markers.find((m) => m.segmentId === nextSegment?.id);
      if (marker && audioRef) {
        audioRef.currentTime = marker.start;
      }
    }
  };

  const handleSkipBack = () => {
    if (audioRef) {
      audioRef.currentTime = Math.max(0, audioRef.currentTime - 10);
    }
  };

  const handleSkipForward = () => {
    if (audioRef) {
      audioRef.currentTime = Math.min(duration(), audioRef.currentTime + 10);
    }
  };

  const handleProgressClick = (e: MouseEvent) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const newTime = percent * duration();

    if (audioRef) {
      audioRef.currentTime = newTime;
    }
    props.onTimeUpdate(newTime);
  };

  const handleSpeedChange = (speed: number) => {
    if (audioRef) {
      audioRef.playbackRate = speed;
    }
    setShowSpeedMenu(false);
  };

  // Keyboard shortcuts
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
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
    onCleanup(() => window.removeEventListener('keydown', handleKeyDown));
  });

  return (
    <div style={styles.container}>
      <audio
        ref={audioRef}
        src={props.narrationPath}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
      />

      <div style={styles.progressContainer}>
        <span style={styles.time}>{formatLongTime(props.currentTime)}</span>
        <div style={styles.progressBar} onClick={handleProgressClick}>
          <div style={{ ...styles.progressFill, width: `${progressPercent()}%` }} />
        </div>
        <span style={styles.time}>{formatLongTime(duration())}</span>
      </div>

      <div style={styles.controls}>
        <div style={{ position: 'relative' }}>
          <button
            style={{ ...styles.controlButton, ...styles.speedButton }}
            onClick={() => setShowSpeedMenu(!showSpeedMenu())}
            title="Playback speed"
          >
            {props.playbackSpeed}x
          </button>
          {showSpeedMenu() && (
            <div
              style={{
                position: 'absolute',
                bottom: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                'background-color': 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                'border-radius': '8px',
                padding: '4px',
                'margin-bottom': '8px',
                'z-index': '10',
              }}
            >
              {speedOptions.map((speed) => (
                <button
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 16px',
                    'background-color': speed === props.playbackSpeed ? 'var(--bg-accent)' : 'transparent',
                    border: 'none',
                    'border-radius': '4px',
                    cursor: 'pointer',
                    'font-size': '14px',
                    color: 'var(--text-primary)',
                    'text-align': 'left',
                  }}
                  onClick={() => handleSpeedChange(speed)}
                >
                  {speed}x
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          style={styles.controlButton}
          onClick={handlePrevious}
          disabled={props.currentSegmentIndex === 0}
          title="Previous segment"
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          \u23EE
        </button>

        <button
          style={styles.controlButton}
          onClick={handleSkipBack}
          title="Skip back 10 seconds"
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          \u23EA
        </button>

        <button
          style={{ ...styles.controlButton, ...styles.playButton }}
          onClick={handlePlayPause}
          title={props.isPlaying ? 'Pause' : 'Play'}
        >
          {props.isPlaying ? '\u23F8' : '\u25B6'}
        </button>

        <button
          style={styles.controlButton}
          onClick={handleSkipForward}
          title="Skip forward 10 seconds"
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          \u23E9
        </button>

        <button
          style={styles.controlButton}
          onClick={handleNext}
          disabled={props.currentSegmentIndex >= props.segments.length - 1}
          title="Next segment"
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          \u23ED
        </button>
      </div>

      <div style={styles.segmentInfo}>
        <span style={styles.segmentText}>
          Segment {props.currentSegmentIndex + 1} of {props.segments.length}
        </span>
      </div>
    </div>
  );
}

export default NarrationPlayer;
