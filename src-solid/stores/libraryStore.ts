/**
 * Solid store for library state management
 */

import { createSignal, createMemo, createRoot } from 'solid-js';
import type { Book, BookId } from '../types';
import * as commands from '../tauri/commands';

// =============================================================================
// Store Implementation
// =============================================================================

function createLibraryStore() {
  const [books, setBooks] = createSignal<Book[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [importing, setImporting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const fetchLibrary = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await commands.getLibrary();
      setBooks(result);
      setLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch library';
      setError(message);
      setLoading(false);
    }
  };

  const importBook = async (path: string): Promise<Book> => {
    setLoading(true);
    setImporting(true);
    setError(null);
    try {
      const book = await commands.importBook(path);
      setBooks((prev) => [...prev, book]);
      setLoading(false);
      setImporting(false);
      return book;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import book';
      setError(message);
      setLoading(false);
      setImporting(false);
      throw err;
    }
  };

  const importBundle = async (path: string): Promise<Book> => {
    setLoading(true);
    setImporting(true);
    setError(null);
    try {
      const book = await commands.importBundle(path);
      setBooks((prev) => [...prev, book]);
      setLoading(false);
      setImporting(false);
      return book;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import bundle';
      setError(message);
      setLoading(false);
      setImporting(false);
      throw err;
    }
  };

  const deleteBook = async (id: BookId) => {
    setLoading(true);
    setError(null);
    try {
      await commands.deleteBook(id);
      setBooks((prev) => prev.filter((book) => book.id !== id));
      setLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete book';
      setError(message);
      setLoading(false);
      throw err;
    }
  };

  const updateBook = (updatedBook: Book) => {
    setBooks((prev) =>
      prev.map((book) => (book.id === updatedBook.id ? updatedBook : book))
    );
  };

  const clearError = () => setError(null);

  // Derived state
  const recentBooks = createMemo(() =>
    [...books()]
      .filter((book) => book.lastOpenedAt !== null)
      .sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))
  );

  const newestBooks = createMemo(() =>
    [...books()].sort((a, b) => b.createdAt - a.createdAt)
  );

  const booksWithNarration = createMemo(() =>
    books().filter((book) => book.narrationStatus === 'ready')
  );

  const getBookById = (id: BookId) =>
    books().find((book) => book.id === id);

  return {
    // State
    books,
    loading,
    importing,
    error,
    // Derived
    recentBooks,
    newestBooks,
    booksWithNarration,
    getBookById,
    // Actions
    fetchLibrary,
    importBook,
    importBundle,
    deleteBook,
    updateBook,
    clearError,
  };
}

// Create singleton store
export const libraryStore = createRoot(createLibraryStore);
