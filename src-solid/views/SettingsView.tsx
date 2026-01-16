/**
 * SettingsView Component (Solid)
 *
 * User preferences for theme, font, playback, and other settings.
 */

import { createSignal, createEffect, onMount, For, Show, type JSX } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { settingsStore } from '../stores/settingsStore';
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
    'max-width': '720px',
    margin: '0 auto',
  } as JSX.CSSProperties,
  title: {
    'font-size': '24px',
    'font-weight': '600',
    margin: '0 0 32px 0',
    color: 'var(--text-primary)',
  } as JSX.CSSProperties,
  section: {
    'margin-bottom': '32px',
  } as JSX.CSSProperties,
  sectionTitle: {
    'font-size': '14px',
    'font-weight': '600',
    'text-transform': 'uppercase',
    'letter-spacing': '0.5px',
    color: 'var(--text-secondary)',
    margin: '0 0 16px 0',
  } as JSX.CSSProperties,
  card: {
    'background-color': 'var(--bg-secondary)',
    'border-radius': '12px',
    padding: '4px',
  } as JSX.CSSProperties,
  settingRow: {
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'space-between',
    padding: '16px',
    'border-radius': '8px',
  } as JSX.CSSProperties,
  settingLabel: {
    display: 'flex',
    'flex-direction': 'column',
    gap: '4px',
  } as JSX.CSSProperties,
  settingName: {
    'font-size': '15px',
    'font-weight': '500',
    color: 'var(--text-primary)',
  } as JSX.CSSProperties,
  settingDescription: {
    'font-size': '13px',
    color: 'var(--text-secondary)',
  } as JSX.CSSProperties,
  select: {
    padding: '8px 12px',
    'font-size': '14px',
    'border-radius': '6px',
    border: '1px solid var(--border-color)',
    'background-color': 'var(--bg-primary)',
    color: 'var(--text-primary)',
    'min-width': '140px',
    cursor: 'pointer',
  } as JSX.CSSProperties,
  input: {
    padding: '8px 12px',
    'font-size': '14px',
    'border-radius': '6px',
    border: '1px solid var(--border-color)',
    'background-color': 'var(--bg-primary)',
    color: 'var(--text-primary)',
    width: '80px',
    'text-align': 'right',
  } as JSX.CSSProperties,
  colorInput: {
    width: '48px',
    height: '36px',
    padding: '2px',
    'border-radius': '6px',
    border: '1px solid var(--border-color)',
    'background-color': 'var(--bg-primary)',
    cursor: 'pointer',
  } as JSX.CSSProperties,
  slider: {
    width: '140px',
    height: '8px',
    'border-radius': '4px',
    cursor: 'pointer',
  } as JSX.CSSProperties,
  sliderContainer: {
    display: 'flex',
    'align-items': 'center',
    gap: '12px',
  } as JSX.CSSProperties,
  sliderValue: {
    'font-size': '14px',
    'font-weight': '500',
    color: 'var(--text-primary)',
    'min-width': '40px',
    'text-align': 'right',
  } as JSX.CSSProperties,
  toggle: {
    position: 'relative',
    width: '48px',
    height: '28px',
    'background-color': 'var(--border-color)',
    'border-radius': '14px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  } as JSX.CSSProperties,
  toggleOn: {
    'background-color': 'var(--text-accent)',
  } as JSX.CSSProperties,
  toggleKnob: {
    position: 'absolute',
    top: '2px',
    left: '2px',
    width: '24px',
    height: '24px',
    'background-color': '#ffffff',
    'border-radius': '12px',
    transition: 'transform 0.2s',
  } as JSX.CSSProperties,
  toggleKnobOn: {
    transform: 'translateX(20px)',
  } as JSX.CSSProperties,
  resetButton: {
    padding: '12px 24px',
    'font-size': '14px',
    'font-weight': '500',
    'background-color': 'transparent',
    color: 'var(--error-color)',
    border: '1px solid var(--error-color)',
    'border-radius': '8px',
    cursor: 'pointer',
    transition: 'background-color 0.2s, color 0.2s',
  } as JSX.CSSProperties,
  divider: {
    height: '1px',
    'background-color': 'var(--border-color)',
    margin: '0 16px',
  } as JSX.CSSProperties,
  voiceRow: {
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'space-between',
    padding: '12px 16px',
    'border-radius': '8px',
  } as JSX.CSSProperties,
  voiceInfo: {
    display: 'flex',
    'flex-direction': 'column',
    gap: '2px',
    flex: '1',
    'min-width': '0',
  } as JSX.CSSProperties,
  voiceNameContainer: {
    display: 'flex',
    'align-items': 'center',
    gap: '8px',
  } as JSX.CSSProperties,
  voiceName: {
    'font-size': '15px',
    'font-weight': '500',
    color: 'var(--text-primary)',
  } as JSX.CSSProperties,
  defaultBadge: {
    'font-size': '11px',
    'font-weight': '600',
    color: 'var(--text-accent)',
    'background-color': 'var(--bg-primary)',
    padding: '2px 8px',
    'border-radius': '4px',
    'text-transform': 'uppercase',
  } as JSX.CSSProperties,
  voicePath: {
    'font-size': '12px',
    color: 'var(--text-secondary)',
    overflow: 'hidden',
    'text-overflow': 'ellipsis',
    'white-space': 'nowrap',
  } as JSX.CSSProperties,
  voiceActions: {
    display: 'flex',
    'align-items': 'center',
    gap: '8px',
    'margin-left': '16px',
  } as JSX.CSSProperties,
  actionButton: {
    padding: '6px 12px',
    'font-size': '13px',
    'font-weight': '500',
    'border-radius': '6px',
    border: '1px solid var(--border-color)',
    'background-color': 'var(--bg-primary)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    transition: 'background-color 0.2s, opacity 0.2s',
  } as JSX.CSSProperties,
  actionButtonDisabled: {
    opacity: '0.5',
    cursor: 'not-allowed',
  } as JSX.CSSProperties,
  deleteButton: {
    padding: '6px 12px',
    'font-size': '13px',
    'font-weight': '500',
    'border-radius': '6px',
    border: '1px solid var(--error-color)',
    'background-color': 'transparent',
    color: 'var(--error-color)',
    cursor: 'pointer',
    transition: 'background-color 0.2s, opacity 0.2s',
  } as JSX.CSSProperties,
  addVoiceButton: {
    padding: '12px 20px',
    'font-size': '14px',
    'font-weight': '500',
    'border-radius': '8px',
    border: '1px solid var(--text-accent)',
    'background-color': 'transparent',
    color: 'var(--text-accent)',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    width: '100%',
    'margin-top': '8px',
  } as JSX.CSSProperties,
  loadingText: {
    'font-size': '14px',
    color: 'var(--text-secondary)',
    'text-align': 'center',
    padding: '16px',
  } as JSX.CSSProperties,
  errorText: {
    'font-size': '14px',
    color: 'var(--error-color)',
    'text-align': 'center',
    padding: '16px',
  } as JSX.CSSProperties,
  emptyText: {
    'font-size': '14px',
    color: 'var(--text-secondary)',
    'text-align': 'center',
    padding: '16px',
  } as JSX.CSSProperties,
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

function Toggle(props: ToggleProps) {
  return (
    <div
      style={{
        ...styles.toggle,
        ...(props.checked ? styles.toggleOn : {}),
      }}
      onClick={() => props.onChange(!props.checked)}
      role="switch"
      aria-checked={props.checked}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          props.onChange(!props.checked);
        }
      }}
    >
      <div
        style={{
          ...styles.toggleKnob,
          ...(props.checked ? styles.toggleKnobOn : {}),
        }}
      />
    </div>
  );
}

// =============================================================================
// Component
// =============================================================================

export function SettingsView() {
  const [voices, setVoices] = createSignal<Voice[]>([]);
  const [voicesLoading, setVoicesLoading] = createSignal(false);
  const [voiceError, setVoiceError] = createSignal<string | null>(null);
  const [voiceOperationLoading, setVoiceOperationLoading] = createSignal<string | null>(null);

  // Load voices on mount
  onMount(() => {
    loadVoices();
  });

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
      const selectedFile = await open({
        multiple: false,
        filters: [{ name: 'Audio', extensions: ['wav', 'mp3'] }],
      });

      if (!selectedFile) {
        return;
      }

      const voiceName = window.prompt('Enter a name for this voice:');
      if (!voiceName || voiceName.trim() === '') {
        return;
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
      return;
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
      return;
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
  const handleThemeChange = (value: string) => {
    settingsStore.updateSetting('theme', value as Theme);
  };

  const handleFontSizeChange = (value: string) => {
    const size = parseInt(value, 10);
    if (size >= 10 && size <= 32) {
      settingsStore.updateSetting('fontSize', size);
    }
  };

  const handleFontFamilyChange = (value: string) => {
    settingsStore.updateSetting('fontFamily', value);
  };

  const handleLineHeightChange = (value: string) => {
    const height = parseFloat(value);
    if (height >= 1 && height <= 3) {
      settingsStore.updateSetting('lineHeight', height);
    }
  };

  const handlePlaybackSpeedChange = (value: string) => {
    const speed = parseFloat(value);
    if (speed >= 0.5 && speed <= 2) {
      settingsStore.updateSetting('playbackSpeed', speed);
    }
  };

  const handleHighlightColorChange = (value: string) => {
    settingsStore.updateSetting('highlightColor', value);
  };

  const handleAutoPlayChange = (checked: boolean) => {
    settingsStore.updateSetting('autoPlay', checked);
  };

  const handleSyncPortChange = (value: string) => {
    const port = parseInt(value, 10);
    if (port >= 1024 && port <= 65535) {
      settingsStore.updateSetting('syncPort', port);
    }
  };

  const handleResetClick = () => {
    if (window.confirm('Reset all settings to defaults?')) {
      settingsStore.resetToDefaults();
    }
  };

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
              value={settingsStore.theme()}
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
              value={settingsStore.highlightColor()}
              onInput={(e) => handleHighlightColorChange(e.target.value)}
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
                value={settingsStore.fontSize()}
                onInput={(e) => handleFontSizeChange(e.target.value)}
              />
              <span style={styles.sliderValue}>{settingsStore.fontSize()}px</span>
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
              value={settingsStore.fontFamily()}
              onChange={(e) => handleFontFamilyChange(e.target.value)}
            >
              <For each={fontOptions}>
                {(option) => (
                  <option value={option.value}>{option.label}</option>
                )}
              </For>
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
                value={settingsStore.lineHeight()}
                onInput={(e) => handleLineHeightChange(e.target.value)}
              />
              <span style={styles.sliderValue}>{settingsStore.lineHeight().toFixed(1)}</span>
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
                value={settingsStore.playbackSpeed()}
                onInput={(e) => handlePlaybackSpeedChange(e.target.value)}
              />
              <span style={styles.sliderValue}>{settingsStore.playbackSpeed().toFixed(1)}x</span>
            </div>
          </div>

          <div style={styles.divider} />

          {/* Auto Play */}
          <div style={styles.settingRow}>
            <div style={styles.settingLabel}>
              <span style={styles.settingName}>Auto Play</span>
              <span style={styles.settingDescription}>Start narration when opening a book</span>
            </div>
            <Toggle checked={settingsStore.autoPlay()} onChange={handleAutoPlayChange} />
          </div>
        </div>
      </section>

      {/* Voice Section */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Voice</h2>
        <div style={styles.card}>
          {/* Loading State */}
          <Show when={voicesLoading()}>
            <div style={styles.loadingText}>Loading voices...</div>
          </Show>

          {/* Error State */}
          <Show when={voiceError()}>
            <div style={styles.errorText}>{voiceError()}</div>
          </Show>

          {/* Empty State */}
          <Show when={!voicesLoading() && !voiceError() && voices().length === 0}>
            <div style={styles.emptyText}>No voices configured. Add a voice to get started.</div>
          </Show>

          {/* Voice List */}
          <Show when={!voicesLoading() && voices().length > 0}>
            <For each={voices()}>
              {(voice, index) => (
                <>
                  <Show when={index() > 0}>
                    <div style={styles.divider} />
                  </Show>
                  <div style={styles.voiceRow}>
                    <div style={styles.voiceInfo}>
                      <div style={styles.voiceNameContainer}>
                        <span style={styles.voiceName}>{voice.name}</span>
                        <Show when={voice.isDefault}>
                          <span style={styles.defaultBadge}>Default</span>
                        </Show>
                      </div>
                      <span style={styles.voicePath} title={voice.samplePath}>
                        {voice.samplePath}
                      </span>
                    </div>
                    <div style={styles.voiceActions}>
                      <Show when={!voice.isDefault}>
                        <button
                          style={{
                            ...styles.actionButton,
                            ...(voiceOperationLoading() === voice.id
                              ? styles.actionButtonDisabled
                              : {}),
                          }}
                          onClick={() => handleSetDefaultVoice(voice)}
                          disabled={voiceOperationLoading() === voice.id}
                        >
                          {voiceOperationLoading() === voice.id
                            ? 'Setting...'
                            : 'Set Default'}
                        </button>
                      </Show>
                      <button
                        style={{
                          ...styles.deleteButton,
                          ...(voice.isDefault || voiceOperationLoading() === voice.id
                            ? styles.actionButtonDisabled
                            : {}),
                        }}
                        onClick={() => handleDeleteVoice(voice)}
                        disabled={voice.isDefault || voiceOperationLoading() === voice.id}
                        title={voice.isDefault ? 'Cannot delete default voice' : 'Delete voice'}
                      >
                        {voiceOperationLoading() === voice.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </For>
          </Show>

          {/* Add Voice Button */}
          <button
            style={{
              ...styles.addVoiceButton,
              ...(voiceOperationLoading() === 'create' ? styles.actionButtonDisabled : {}),
            }}
            onClick={handleCreateVoice}
            disabled={voiceOperationLoading() === 'create'}
            onMouseEnter={(e) => {
              if (voiceOperationLoading() !== 'create') {
                e.currentTarget.style.backgroundColor = 'var(--text-accent)';
                e.currentTarget.style.color = '#ffffff';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-accent)';
            }}
          >
            {voiceOperationLoading() === 'create' ? 'Creating Voice...' : 'Add New Voice'}
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
              value={settingsStore.syncPort()}
              onInput={(e) => handleSyncPortChange(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Reset Section */}
      <section style={styles.section}>
        <button
          style={styles.resetButton}
          onClick={handleResetClick}
          disabled={settingsStore.loading()}
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
