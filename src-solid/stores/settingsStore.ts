/**
 * Solid store for application settings management
 */

import { createSignal, createRoot } from 'solid-js';
import type { Settings, Theme, VoiceId } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import * as commands from '../tauri/commands';

// =============================================================================
// Helper Functions
// =============================================================================

function toSnakeCase(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function toCamelCase(key: string): string {
  return key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function serializeValue(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function deserializeValue<T>(value: string, defaultValue: T): T {
  if (value === null || value === undefined) return defaultValue;
  if (typeof defaultValue === 'string') return value as T;
  if (typeof defaultValue === 'boolean') return (value === 'true') as T;
  if (typeof defaultValue === 'number') {
    const num = parseFloat(value);
    return (isNaN(num) ? defaultValue : num) as T;
  }
  if (defaultValue === null) {
    if (value === 'null' || value === '') return null as T;
    return value as T;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return defaultValue;
  }
}

// =============================================================================
// Store Implementation
// =============================================================================

function createSettingsStore() {
  const [settings, setSettings] = createSignal<Settings>({ ...DEFAULT_SETTINGS });
  const [initialized, setInitialized] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const storedSettings = await commands.getAllSettings();
      const parsed: Partial<Settings> = {};

      for (const [snakeKey, value] of Object.entries(storedSettings)) {
        const camelKey = toCamelCase(snakeKey) as keyof Settings;
        if (camelKey in DEFAULT_SETTINGS) {
          const defaultValue = DEFAULT_SETTINGS[camelKey];
          (parsed as Record<string, unknown>)[camelKey] = deserializeValue(value, defaultValue);
        }
      }

      setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      setInitialized(true);
      setLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load settings';
      setError(message);
      setLoading(false);
      setInitialized(true);
    }
  };

  const updateSetting = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const previousValue = settings()[key];
    setSettings((prev) => ({ ...prev, [key]: value }));

    try {
      const snakeKey = toSnakeCase(key);
      await commands.setSetting(snakeKey, serializeValue(value));
    } catch (err) {
      setSettings((prev) => ({ ...prev, [key]: previousValue }));
      const message = err instanceof Error ? err.message : 'Failed to update setting';
      setError(message);
      throw err;
    }
  };

  const resetToDefaults = async () => {
    setLoading(true);
    setError(null);
    try {
      const promises = Object.entries(DEFAULT_SETTINGS).map(([key, value]) => {
        const snakeKey = toSnakeCase(key);
        return commands.setSetting(snakeKey, serializeValue(value));
      });
      await Promise.all(promises);
      setSettings({ ...DEFAULT_SETTINGS });
      setLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset settings';
      setError(message);
      setLoading(false);
      throw err;
    }
  };

  const clearError = () => setError(null);

  return {
    // State accessors
    settings,
    initialized,
    loading,
    error,
    // Derived accessors
    theme: () => settings().theme,
    fontSize: () => settings().fontSize,
    fontFamily: () => settings().fontFamily,
    lineHeight: () => settings().lineHeight,
    playbackSpeed: () => settings().playbackSpeed,
    highlightColor: () => settings().highlightColor,
    defaultVoice: () => settings().defaultVoice,
    autoPlay: () => settings().autoPlay,
    syncPort: () => settings().syncPort,
    // Actions
    loadSettings,
    updateSetting,
    resetToDefaults,
    clearError,
  };
}

// Create singleton store
export const settingsStore = createRoot(createSettingsStore);
