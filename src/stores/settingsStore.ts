/**
 * Zustand store for application settings management
 *
 * Manages all user preferences and settings.
 * Settings are persisted to the backend via Tauri commands.
 */

import { create } from 'zustand';
import type { Settings, Theme, VoiceId } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import * as commands from '../tauri/commands';

// =============================================================================
// Store Interface
// =============================================================================

interface SettingsState extends Settings {
  /** Whether settings have been loaded from backend */
  initialized: boolean;
  /** Loading state for async operations */
  loading: boolean;
  /** Error message from last failed operation */
  error: string | null;
}

interface SettingsActions {
  /** Load all settings from backend */
  loadSettings: () => Promise<void>;
  /** Update a single setting */
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
  /** Update multiple settings at once */
  updateSettings: (settings: Partial<Settings>) => Promise<void>;
  /** Reset all settings to defaults */
  resetToDefaults: () => Promise<void>;
  /** Clear any error state */
  clearError: () => void;
}

type SettingsStore = SettingsState & SettingsActions;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert a settings key from camelCase to snake_case for backend storage
 */
function toSnakeCase(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Convert a settings key from snake_case to camelCase
 */
function toCamelCase(key: string): string {
  return key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Serialize a setting value to string for storage
 */
function serializeValue(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

/**
 * Deserialize a stored string value to the appropriate type
 */
function deserializeValue<T>(value: string, defaultValue: T): T {
  if (value === null || value === undefined) return defaultValue;

  // Handle string types directly
  if (typeof defaultValue === 'string') {
    return value as T;
  }

  // Handle boolean
  if (typeof defaultValue === 'boolean') {
    return (value === 'true') as T;
  }

  // Handle number
  if (typeof defaultValue === 'number') {
    const num = parseFloat(value);
    return (isNaN(num) ? defaultValue : num) as T;
  }

  // Handle null (for optional values like defaultVoice)
  if (defaultValue === null) {
    if (value === 'null' || value === '') return null as T;
    return value as T;
  }

  // Try JSON parse for complex types
  try {
    return JSON.parse(value) as T;
  } catch {
    return defaultValue;
  }
}

// =============================================================================
// Store Implementation
// =============================================================================

export const useSettingsStore = create<SettingsStore>()((set, get) => ({
  // ---------------------------------------------------------------------------
  // State (initialized with defaults)
  // ---------------------------------------------------------------------------
  ...DEFAULT_SETTINGS,
  initialized: false,
  loading: false,
  error: null,

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  loadSettings: async () => {
    set({ loading: true, error: null });
    try {
      const storedSettings = await commands.getAllSettings();

      // Map stored settings to state
      const settings: Partial<Settings> = {};

      for (const [snakeKey, value] of Object.entries(storedSettings)) {
        const camelKey = toCamelCase(snakeKey) as keyof Settings;
        if (camelKey in DEFAULT_SETTINGS) {
          const defaultValue = DEFAULT_SETTINGS[camelKey];
          (settings as Record<string, unknown>)[camelKey] = deserializeValue(value, defaultValue);
        }
      }

      set({
        ...DEFAULT_SETTINGS,
        ...settings,
        initialized: true,
        loading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load settings';
      set({ error: message, loading: false, initialized: true });
    }
  },

  updateSetting: async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const previousValue = get()[key];

    // Optimistic update
    set({ [key]: value } as Partial<SettingsState>);

    try {
      const snakeKey = toSnakeCase(key);
      await commands.setSetting(snakeKey, serializeValue(value));
    } catch (err) {
      // Rollback on error
      set({ [key]: previousValue } as Partial<SettingsState>);
      const message = err instanceof Error ? err.message : 'Failed to update setting';
      set({ error: message });
      throw err;
    }
  },

  updateSettings: async (settings: Partial<Settings>) => {
    const previousState: Partial<Settings> = {};

    // Capture previous values for rollback
    for (const key of Object.keys(settings) as (keyof Settings)[]) {
      // @ts-expect-error - Type assignment works at runtime
      previousState[key] = get()[key];
    }

    // Optimistic update
    set(settings as Partial<SettingsState>);

    try {
      // Save each setting to backend
      const promises = Object.entries(settings).map(([key, value]) => {
        const snakeKey = toSnakeCase(key);
        return commands.setSetting(snakeKey, serializeValue(value));
      });
      await Promise.all(promises);
    } catch (err) {
      // Rollback on error
      set(previousState as Partial<SettingsState>);
      const message = err instanceof Error ? err.message : 'Failed to update settings';
      set({ error: message });
      throw err;
    }
  },

  resetToDefaults: async () => {
    set({ loading: true, error: null });
    try {
      // Save all defaults to backend
      const promises = Object.entries(DEFAULT_SETTINGS).map(([key, value]) => {
        const snakeKey = toSnakeCase(key);
        return commands.setSetting(snakeKey, serializeValue(value));
      });
      await Promise.all(promises);

      set({
        ...DEFAULT_SETTINGS,
        loading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset settings';
      set({ error: message, loading: false });
      throw err;
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
 * Select theme preference
 */
export const selectTheme = (state: SettingsStore): Theme => state.theme;

/**
 * Select font settings for the reader
 */
export const selectFontSettings = (state: SettingsStore) => ({
  fontSize: state.fontSize,
  fontFamily: state.fontFamily,
  lineHeight: state.lineHeight,
});

/**
 * Select playback settings
 */
export const selectPlaybackSettings = (state: SettingsStore) => ({
  playbackSpeed: state.playbackSpeed,
  autoPlay: state.autoPlay,
});

/**
 * Select default voice ID
 */
export const selectDefaultVoice = (state: SettingsStore): VoiceId | null => state.defaultVoice;

/**
 * Select highlight color
 */
export const selectHighlightColor = (state: SettingsStore): string => state.highlightColor;

/**
 * Select sync port
 */
export const selectSyncPort = (state: SettingsStore): number => state.syncPort;
