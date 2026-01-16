/**
 * Type-safe wrappers around Tauri invoke() for IPC commands
 *
 * All commands match ARCHITECTURE.md Key Interfaces section.
 * Uses GLOSSARY.md terminology throughout.
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  Book,
  BookId,
  Segment,
  Progress,
  Voice,
  VoiceId,
  SyncServer,
  SyncResult,
} from '../types';

// =============================================================================
// Library Commands
// =============================================================================

/**
 * Import a book from a source file path
 * @param path - Path to the source file (epub, markdown, txt, pdf)
 * @returns The imported Book
 */
export async function importBook(path: string): Promise<Book> {
  return invoke<Book>('import_book', { path });
}

/**
 * Get all books in the library
 * @returns Array of all books
 */
export async function getLibrary(): Promise<Book[]> {
  return invoke<Book[]>('get_library');
}

/**
 * Delete a book from the library
 * @param id - BookId to delete
 */
export async function deleteBook(id: BookId): Promise<void> {
  return invoke<void>('delete_book', { id });
}

// =============================================================================
// Reader Commands
// =============================================================================

/**
 * Get a single book by ID
 * @param id - BookId to retrieve
 * @returns The Book
 */
export async function getBook(id: BookId): Promise<Book> {
  return invoke<Book>('get_book', { id });
}

/**
 * Get all segments for a book
 * @param bookId - BookId to get segments for
 * @returns Array of segments ordered by index
 */
export async function getSegments(bookId: BookId): Promise<Segment[]> {
  return invoke<Segment[]>('get_segments', { bookId });
}

/**
 * Get markers for a book (narration timing data)
 * @param bookId - BookId to get markers for
 * @returns Array of markers ordered by start time
 */
export async function getMarkers(bookId: BookId): Promise<import('../types').Marker[]> {
  return invoke<import('../types').Marker[]>('get_markers', { bookId });
}

/**
 * Save reading progress for a book
 * @param bookId - BookId to save progress for
 * @param progress - Progress data to save
 */
export async function saveProgress(bookId: BookId, progress: Progress): Promise<void> {
  return invoke<void>('save_progress', { bookId, progress });
}

/**
 * Get reading progress for a book
 * @param bookId - BookId to get progress for
 * @returns Progress or null if no progress saved
 */
export async function getProgress(bookId: BookId): Promise<Progress | null> {
  return invoke<Progress | null>('get_progress', { bookId });
}

// =============================================================================
// TTS Commands (Desktop Only)
// =============================================================================

/**
 * Generate narration for a book using specified voice
 * @param bookId - BookId to generate narration for
 * @param voiceId - VoiceId to use for generation
 */
export async function generateNarration(bookId: BookId, voiceId: VoiceId): Promise<void> {
  return invoke<void>('generate_narration', { bookId, voiceId });
}

/**
 * Get all available voices
 * @returns Array of voices
 */
export async function getVoices(): Promise<Voice[]> {
  return invoke<Voice[]>('get_voices');
}

/**
 * Cancel ongoing narration generation
 */
export async function cancelGeneration(): Promise<void> {
  return invoke<void>('cancel_generation');
}

// =============================================================================
// Bundle Commands
// =============================================================================

/**
 * Export a book as a .actualbook bundle
 * @param bookId - BookId to export
 * @param path - Destination path for the bundle
 */
export async function exportBundle(bookId: BookId, path: string): Promise<void> {
  return invoke<void>('export_bundle', { bookId, path });
}

/**
 * Import a .actualbook bundle
 * @param path - Path to the .actualbook file
 * @returns The imported Book
 */
export async function importBundle(path: string): Promise<Book> {
  return invoke<Book>('import_bundle', { path });
}

// =============================================================================
// Sync Commands
// =============================================================================

/**
 * Start the local sync server
 */
export async function startSyncServer(): Promise<void> {
  return invoke<void>('start_sync_server');
}

/**
 * Stop the local sync server
 */
export async function stopSyncServer(): Promise<void> {
  return invoke<void>('stop_sync_server');
}

/**
 * Discover sync servers on the local network
 * @returns Array of discovered servers
 */
export async function discoverSyncServers(): Promise<SyncServer[]> {
  return invoke<SyncServer[]>('discover_sync_servers');
}

/**
 * Sync with a discovered server
 * @param server - SyncServer to sync with
 * @returns Result of the sync operation
 */
export async function syncWith(server: SyncServer): Promise<SyncResult> {
  return invoke<SyncResult>('sync_with', { server });
}

// =============================================================================
// Settings Commands
// =============================================================================

/**
 * Get a setting value
 * @param key - Setting key
 * @returns Setting value as string, or null if not set
 */
export async function getSetting(key: string): Promise<string | null> {
  return invoke<string | null>('get_setting', { key });
}

/**
 * Set a setting value
 * @param key - Setting key
 * @param value - Setting value (will be serialized to string)
 */
export async function setSetting(key: string, value: string): Promise<void> {
  return invoke<void>('set_setting', { key, value });
}

/**
 * Get all settings
 * @returns Object with all settings
 */
export async function getAllSettings(): Promise<Record<string, string>> {
  return invoke<Record<string, string>>('get_all_settings');
}
