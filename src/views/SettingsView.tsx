/**
 * SettingsView Component
 *
 * User preferences for theme, font, playback, and other settings.
 * Uses the settingsStore for state management.
 */

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useSettingsStore } from '../stores/settingsStore';
import type { Theme } from '../types';

// =============================================================================
// Types
// =============================================================================

interface Voice {
  id: string;
  name: string;
  samplePath: string;
  isDefault: boolean;
}

// =============================================================================
// Styles
// =============================================================================

const styles = {
  container: {
    padding: '24px',
    maxWidth: '720px',
    margin: '0 auto',
  },
  title: {
    fontSize: '24px',
    fontWeight: 600,
    margin: '0 0 32px 0',
    color: 'var(--text-primary)',
  },
  section: {
    marginBottom: '32px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    color: 'var(--text-secondary)',
    margin: '0 0 16px 0',
  },
  card: {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '12px',
    padding: '4px',
  },
  settingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px',
    borderRadius: '8px',
  },
  settingLabel: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  settingName: {
    fontSize: '15px',
    fontWeight: 500,
    color: 'var(--text-primary)',
  },
  settingDescription: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
  },
  select: {
    padding: '8px 12px',
    fontSize: '14px',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    minWidth: '140px',
    cursor: 'pointer',
  },
  input: {
    padding: '8px 12px',
    fontSize: '14px',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    width: '80px',
    textAlign: 'right' as const,
  },
  colorInput: {
    width: '48px',
    height: '36px',
    padding: '2px',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-primary)',
    cursor: 'pointer',
  },
  slider: {
    width: '140px',
    height: '8px',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  sliderContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  sliderValue: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text-primary)',
    minWidth: '40px',
    textAlign: 'right' as const,
  },
  toggle: {
    position: 'relative' as const,
    width: '48px',
    height: '28px',
    backgroundColor: 'var(--border-color)',
    borderRadius: '14px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  toggleOn: {
    backgroundColor: 'var(--text-accent)',
  },
  toggleKnob: {
    position: 'absolute' as const,
    top: '2px',
    left: '2px',
    width: '24px',
    height: '24px',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    transition: 'transform 0.2s',
  },
  toggleKnobOn: {
    transform: 'translateX(20px)',
  },
  resetButton: {
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: 500,
    backgroundColor: 'transparent',
    color: 'var(--error-color)',
    border: '1px solid var(--error-color)',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.2s, color 0.2s',
  },
  divider: {
    height: '1px',
    backgroundColor: 'var(--border-color)',
    margin: '0 16px',
  },
  // Voice section styles
  voiceRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderRadius: '8px',
  },
  voiceInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
    flex: 1,
    minWidth: 0,
  },
  voiceNameContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  voiceName: {
    fontSize: '15px',
    fontWeight: 500,
    color: 'var(--text-primary)',
  },
  defaultBadge: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-accent)',
    backgroundColor: 'var(--bg-primary)',
    padding: '2px 8px',
    borderRadius: '4px',
    textTransform: 'uppercase' as const,
  },
  voicePath: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  voiceActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginLeft: '16px',
  },
  actionButton: {
    padding: '6px 12px',
    fontSize: '13px',
    fontWeight: 500,
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    transition: 'background-color 0.2s, opacity 0.2s',
  },
  actionButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  deleteButton: {
    padding: '6px 12px',
    fontSize: '13px',
    fontWeight: 500,
    borderRadius: '6px',
    border: '1px solid var(--error-color)',
    backgroundColor: 'transparent',
    color: 'var(--error-color)',
    cursor: 'pointer',
    transition: 'background-color 0.2s, opacity 0.2s',
  },
  addVoiceButton: {
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: 500,
    borderRadius: '8px',
    border: '1px solid var(--text-accent)',
    backgroundColor: 'transparent',
    color: 'var(--text-accent)',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    width: '100%',
    marginTop: '8px',
  },
  loadingText: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    textAlign: 'center' as const,
    padding: '16px',
  },
  errorText: {
    fontSize: '14px',
    color: 'var(--error-color)',
    textAlign: 'center' as const,
    padding: '16px',
  },
  emptyText: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    textAlign: 'center' as const,
    padding: '16px',
  },
};

// =============================================================================
// Font Options
// =============================================================================

const fontOptions = [
  { value: 'system', label: 'System Default' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: '"Times New Roman", serif', label: 'Times New Roman' },
  { value: 'Palatino, serif', label: 'Palatino' },
  { value: '"Helvetica Neue", sans-serif', label: 'Helvetica' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: '"SF Pro Text", sans-serif', label: 'SF Pro' },
  { value: '"Fira Code", monospace', label: 'Fira Code' },
];

// =============================================================================
// Toggle Component
// =============================================================================

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <div
      style={{
        ...styles.toggle,
        ...(checked ? styles.toggleOn : {}),
      }}
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onChange(!checked);
        }
      }}
    >
      <div
        style={{
          ...styles.toggleKnob,
          ...(checked ? styles.toggleKnobOn : {}),
        }}
      />
    </div>
  );
}

// =============================================================================
// Component
// =============================================================================

export function SettingsView() {
  const {
    theme,
    fontSize,
    fontFamily,
    lineHeight,
    playbackSpeed,
    highlightColor,
    autoPlay,
    syncPort,
    updateSetting,
    resetToDefaults,
    loading,
  } = useSettingsStore();

  // Voice management state
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceOperationLoading, setVoiceOperationLoading] = useState<string | null>(null);

  // Load voices on mount
  useEffect(() => {
    loadVoices();
  }, []);

  const loadVoices = async () => {
    setVoicesLoading(true);
    try {
      const result = await invoke<Voice[]>('get_voices');
      setVoices(result);
      setVoiceError(null);
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : 'Failed to load voices');
    } finally {
      setVoicesLoading(false);
    }
  };

  const handleCreateVoice = async () => {
    try {
      // Open file picker for audio sample
      const selectedFile = await open({
        multiple: false,
        filters: [{ name: 'Audio', extensions: ['wav', 'mp3'] }],
      });

      if (!selectedFile) {
        return; // User cancelled
      }

      // Prompt for voice name
      const voiceName = window.prompt('Enter a name for this voice:');
      if (!voiceName || voiceName.trim() === '') {
        return; // User cancelled or entered empty name
      }

      setVoiceOperationLoading('create');
      setVoiceError(null);

      const newVoice = await invoke<Voice>('create_voice', {
        name: voiceName.trim(),
        samplePath: selectedFile,
      });

      setVoices((prev) => [...prev, newVoice]);
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : 'Failed to create voice');
    } finally {
      setVoiceOperationLoading(null);
    }
  };

  const handleDeleteVoice = async (voice: Voice) => {
    if (voice.isDefault) {
      return; // Cannot delete default voice
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete the voice "${voice.name}"? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setVoiceOperationLoading(voice.id);
    setVoiceError(null);

    try {
      await invoke('delete_voice', { id: voice.id });
      setVoices((prev) => prev.filter((v) => v.id !== voice.id));
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : 'Failed to delete voice');
    } finally {
      setVoiceOperationLoading(null);
    }
  };

  const handleSetDefaultVoice = async (voice: Voice) => {
    if (voice.isDefault) {
      return; // Already default
    }

    setVoiceOperationLoading(voice.id);
    setVoiceError(null);

    try {
      await invoke('set_default_voice', { id: voice.id });
      setVoices((prev) =>
        prev.map((v) => ({
          ...v,
          isDefault: v.id === voice.id,
        }))
      );
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : 'Failed to set default voice');
    } finally {
      setVoiceOperationLoading(null);
    }
  };

  // Handlers
  const handleThemeChange = useCallback((value: string) => {
    updateSetting('theme', value as Theme);
  }, [updateSetting]);

  const handleFontSizeChange = useCallback((value: string) => {
    const size = parseInt(value, 10);
    if (size >= 10 && size <= 32) {
      updateSetting('fontSize', size);
    }
  }, [updateSetting]);

  const handleFontFamilyChange = useCallback((value: string) => {
    updateSetting('fontFamily', value);
  }, [updateSetting]);

  const handleLineHeightChange = useCallback((value: string) => {
    const height = parseFloat(value);
    if (height >= 1 && height <= 3) {
      updateSetting('lineHeight', height);
    }
  }, [updateSetting]);

  const handlePlaybackSpeedChange = useCallback((value: string) => {
    const speed = parseFloat(value);
    if (speed >= 0.5 && speed <= 2) {
      updateSetting('playbackSpeed', speed);
    }
  }, [updateSetting]);

  const handleHighlightColorChange = useCallback((value: string) => {
    updateSetting('highlightColor', value);
  }, [updateSetting]);

  const handleAutoPlayChange = useCallback((checked: boolean) => {
    updateSetting('autoPlay', checked);
  }, [updateSetting]);

  const handleSyncPortChange = useCallback((value: string) => {
    const port = parseInt(value, 10);
    if (port >= 1024 && port <= 65535) {
      updateSetting('syncPort', port);
    }
  }, [updateSetting]);

  const handleResetClick = useCallback(() => {
    if (window.confirm('Reset all settings to defaults?')) {
      resetToDefaults();
    }
  }, [resetToDefaults]);

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Settings</h1>

      {/* Appearance Section */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Appearance</h2>
        <div style={styles.card}>
          {/* Theme */}
          <div style={styles.settingRow}>
            <div style={styles.settingLabel}>
              <span style={styles.settingName}>Theme</span>
              <span style={styles.settingDescription}>Color scheme for the app</span>
            </div>
            <select
              style={styles.select}
              value={theme}
              onChange={(e) => handleThemeChange(e.target.value)}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <div style={styles.divider} />

          {/* Highlight Color */}
          <div style={styles.settingRow}>
            <div style={styles.settingLabel}>
              <span style={styles.settingName}>Highlight Color</span>
              <span style={styles.settingDescription}>Color for current segment</span>
            </div>
            <input
              type="color"
              style={styles.colorInput}
              value={highlightColor}
              onChange={(e) => handleHighlightColorChange(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Reader Section */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Reader</h2>
        <div style={styles.card}>
          {/* Font Size */}
          <div style={styles.settingRow}>
            <div style={styles.settingLabel}>
              <span style={styles.settingName}>Font Size</span>
              <span style={styles.settingDescription}>Text size in pixels</span>
            </div>
            <div style={styles.sliderContainer}>
              <input
                type="range"
                style={styles.slider}
                min="10"
                max="32"
                step="1"
                value={fontSize}
                onChange={(e) => handleFontSizeChange(e.target.value)}
              />
              <span style={styles.sliderValue}>{fontSize}px</span>
            </div>
          </div>

          <div style={styles.divider} />

          {/* Font Family */}
          <div style={styles.settingRow}>
            <div style={styles.settingLabel}>
              <span style={styles.settingName}>Font</span>
              <span style={styles.settingDescription}>Typeface for reading</span>
            </div>
            <select
              style={styles.select}
              value={fontFamily}
              onChange={(e) => handleFontFamilyChange(e.target.value)}
            >
              {fontOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.divider} />

          {/* Line Height */}
          <div style={styles.settingRow}>
            <div style={styles.settingLabel}>
              <span style={styles.settingName}>Line Height</span>
              <span style={styles.settingDescription}>Spacing between lines</span>
            </div>
            <div style={styles.sliderContainer}>
              <input
                type="range"
                style={styles.slider}
                min="1"
                max="3"
                step="0.1"
                value={lineHeight}
                onChange={(e) => handleLineHeightChange(e.target.value)}
              />
              <span style={styles.sliderValue}>{lineHeight.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Playback Section */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Playback</h2>
        <div style={styles.card}>
          {/* Playback Speed */}
          <div style={styles.settingRow}>
            <div style={styles.settingLabel}>
              <span style={styles.settingName}>Playback Speed</span>
              <span style={styles.settingDescription}>Narration speed multiplier</span>
            </div>
            <div style={styles.sliderContainer}>
              <input
                type="range"
                style={styles.slider}
                min="0.5"
                max="2"
                step="0.1"
                value={playbackSpeed}
                onChange={(e) => handlePlaybackSpeedChange(e.target.value)}
              />
              <span style={styles.sliderValue}>{playbackSpeed.toFixed(1)}x</span>
            </div>
          </div>

          <div style={styles.divider} />

          {/* Auto Play */}
          <div style={styles.settingRow}>
            <div style={styles.settingLabel}>
              <span style={styles.settingName}>Auto Play</span>
              <span style={styles.settingDescription}>Start narration when opening a book</span>
            </div>
            <Toggle checked={autoPlay} onChange={handleAutoPlayChange} />
          </div>
        </div>
      </section>

      {/* Voice Section */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Voice</h2>
        <div style={styles.card}>
          {/* Loading State */}
          {voicesLoading && (
            <div style={styles.loadingText}>Loading voices...</div>
          )}

          {/* Error State */}
          {voiceError && (
            <div style={styles.errorText}>{voiceError}</div>
          )}

          {/* Empty State */}
          {!voicesLoading && !voiceError && voices.length === 0 && (
            <div style={styles.emptyText}>No voices configured. Add a voice to get started.</div>
          )}

          {/* Voice List */}
          {!voicesLoading && voices.length > 0 && (
            <>
              {voices.map((voice, index) => (
                <div key={voice.id}>
                  {index > 0 && <div style={styles.divider} />}
                  <div style={styles.voiceRow}>
                    <div style={styles.voiceInfo}>
                      <div style={styles.voiceNameContainer}>
                        <span style={styles.voiceName}>{voice.name}</span>
                        {voice.isDefault && (
                          <span style={styles.defaultBadge}>Default</span>
                        )}
                      </div>
                      <span style={styles.voicePath} title={voice.samplePath}>
                        {voice.samplePath}
                      </span>
                    </div>
                    <div style={styles.voiceActions}>
                      {!voice.isDefault && (
                        <button
                          style={{
                            ...styles.actionButton,
                            ...(voiceOperationLoading === voice.id
                              ? styles.actionButtonDisabled
                              : {}),
                          }}
                          onClick={() => handleSetDefaultVoice(voice)}
                          disabled={voiceOperationLoading === voice.id}
                        >
                          {voiceOperationLoading === voice.id
                            ? 'Setting...'
                            : 'Set Default'}
                        </button>
                      )}
                      <button
                        style={{
                          ...styles.deleteButton,
                          ...(voice.isDefault || voiceOperationLoading === voice.id
                            ? styles.actionButtonDisabled
                            : {}),
                        }}
                        onClick={() => handleDeleteVoice(voice)}
                        disabled={voice.isDefault || voiceOperationLoading === voice.id}
                        title={voice.isDefault ? 'Cannot delete default voice' : 'Delete voice'}
                      >
                        {voiceOperationLoading === voice.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Add Voice Button */}
          <button
            style={{
              ...styles.addVoiceButton,
              ...(voiceOperationLoading === 'create' ? styles.actionButtonDisabled : {}),
            }}
            onClick={handleCreateVoice}
            disabled={voiceOperationLoading === 'create'}
            onMouseEnter={(e) => {
              if (voiceOperationLoading !== 'create') {
                e.currentTarget.style.backgroundColor = 'var(--text-accent)';
                e.currentTarget.style.color = '#ffffff';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-accent)';
            }}
          >
            {voiceOperationLoading === 'create' ? 'Creating Voice...' : 'Add New Voice'}
          </button>
        </div>
      </section>

      {/* Sync Section */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Sync</h2>
        <div style={styles.card}>
          {/* Sync Port */}
          <div style={styles.settingRow}>
            <div style={styles.settingLabel}>
              <span style={styles.settingName}>Sync Port</span>
              <span style={styles.settingDescription}>Local network port for device sync</span>
            </div>
            <input
              type="number"
              style={styles.input}
              min="1024"
              max="65535"
              value={syncPort}
              onChange={(e) => handleSyncPortChange(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Reset Section */}
      <section style={styles.section}>
        <button
          style={styles.resetButton}
          onClick={handleResetClick}
          disabled={loading}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--error-color)';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--error-color)';
          }}
        >
          Reset to Defaults
        </button>
      </section>
    </div>
  );
}

export default SettingsView;
