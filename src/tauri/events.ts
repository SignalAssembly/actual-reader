/**
 * Type-safe event listeners for Tauri backend events
 *
 * All events match ARCHITECTURE.md Key Interfaces section.
 * Uses GLOSSARY.md terminology throughout.
 */

import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type {
  GenerationProgressPayload,
  GenerationCompletePayload,
  GenerationErrorPayload,
  SyncDiscoveredPayload,
  SyncProgressPayload,
} from '../types';

// =============================================================================
// Event Names (constants for type safety)
// =============================================================================

export const EVENTS = {
  /** Narration generation progress update */
  GENERATION_PROGRESS: 'generation_progress',
  /** Narration generation completed */
  GENERATION_COMPLETE: 'generation_complete',
  /** Narration generation error */
  GENERATION_ERROR: 'generation_error',
  /** Sync server discovered on network */
  SYNC_DISCOVERED: 'sync_discovered',
  /** Sync operation progress update */
  SYNC_PROGRESS: 'sync_progress',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

// =============================================================================
// TTS Generation Events
// =============================================================================

/**
 * Listen for narration generation progress updates
 * @param callback - Called with progress payload on each update
 * @returns Unlisten function to remove the listener
 */
export async function onGenerationProgress(
  callback: (payload: GenerationProgressPayload) => void
): Promise<UnlistenFn> {
  return listen<GenerationProgressPayload>(EVENTS.GENERATION_PROGRESS, (event) => {
    callback(event.payload);
  });
}

/**
 * Listen for narration generation completion
 * @param callback - Called when generation completes
 * @returns Unlisten function to remove the listener
 */
export async function onGenerationComplete(
  callback: (payload: GenerationCompletePayload) => void
): Promise<UnlistenFn> {
  return listen<GenerationCompletePayload>(EVENTS.GENERATION_COMPLETE, (event) => {
    callback(event.payload);
  });
}

/**
 * Listen for narration generation errors
 * @param callback - Called when generation fails
 * @returns Unlisten function to remove the listener
 */
export async function onGenerationError(
  callback: (payload: GenerationErrorPayload) => void
): Promise<UnlistenFn> {
  return listen<GenerationErrorPayload>(EVENTS.GENERATION_ERROR, (event) => {
    callback(event.payload);
  });
}

// =============================================================================
// Sync Events
// =============================================================================

/**
 * Listen for sync server discovery on local network
 * @param callback - Called when a server is discovered
 * @returns Unlisten function to remove the listener
 */
export async function onSyncDiscovered(
  callback: (payload: SyncDiscoveredPayload) => void
): Promise<UnlistenFn> {
  return listen<SyncDiscoveredPayload>(EVENTS.SYNC_DISCOVERED, (event) => {
    callback(event.payload);
  });
}

/**
 * Listen for sync operation progress updates
 * @param callback - Called with progress percentage
 * @returns Unlisten function to remove the listener
 */
export async function onSyncProgress(
  callback: (payload: SyncProgressPayload) => void
): Promise<UnlistenFn> {
  return listen<SyncProgressPayload>(EVENTS.SYNC_PROGRESS, (event) => {
    callback(event.payload);
  });
}

// =============================================================================
// Utility: Event Subscription Manager
// =============================================================================

/**
 * Manages multiple event subscriptions for easy cleanup
 *
 * @example
 * ```typescript
 * const manager = new EventSubscriptionManager();
 *
 * // In component mount
 * await manager.add(onGenerationProgress((p) => console.log(p.percent)));
 * await manager.add(onGenerationComplete((p) => console.log('done')));
 *
 * // In component unmount
 * manager.unlistenAll();
 * ```
 */
export class EventSubscriptionManager {
  private unlisteners: UnlistenFn[] = [];

  /**
   * Add a subscription to be managed
   * @param unlistenPromise - Promise that resolves to unlisten function
   */
  async add(unlistenPromise: Promise<UnlistenFn>): Promise<void> {
    const unlisten = await unlistenPromise;
    this.unlisteners.push(unlisten);
  }

  /**
   * Remove all subscriptions
   */
  unlistenAll(): void {
    for (const unlisten of this.unlisteners) {
      unlisten();
    }
    this.unlisteners = [];
  }

  /**
   * Get the number of active subscriptions
   */
  get count(): number {
    return this.unlisteners.length;
  }
}
