/**
 * Zustand store for library state management
 *
 * Manages the collection of all books.
 * Uses GLOSSARY.md terminology: "library" not "catalog", "book" not "document"
 */

import { create } from 'zustand';
import type { Book, BookId } from '../types';
import * as commands from '../tauri/commands';

// =============================================================================
// Store Interface
// =============================================================================

interface LibraryState {
  /** All books in the library */
  books: Book[];
  /** Loading state for async operations */
  loading: boolean;
  /** Importing state for book import operations */
  importing: boolean;
  /** Error message from last failed operation */
  error: string | null;
}

interface LibraryActions {
  /** Fetch all books from backend */
  fetchLibrary: () => Promise<void>;
  /** Import a book from a source file path */
  importBook: (path: string) => Promise<Book>;
  /** Import a .actualbook bundle */
  importBundle: (path: string) => Promise<Book>;
  /** Delete a book from the library */
  deleteBook: (id: BookId) => Promise<void>;
  /** Update a book in the local state (for optimistic updates) */
  updateBook: (book: Book) => void;
  /** Clear any error state */
  clearError: () => void;
}

type LibraryStore = LibraryState & LibraryActions;

// =============================================================================
// Store Implementation
// =============================================================================

export const useLibraryStore = create<LibraryStore>()((set) => ({
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  books: [],
  loading: false,
  importing: false,
  error: null,

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  fetchLibrary: async () => {
    set({ loading: true, error: null });
    try {
      const books = await commands.getLibrary();
      set({ books, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch library';
      set({ error: message, loading: false });
    }
  },

  importBook: async (path: string) => {
    set({ loading: true, importing: true, error: null });
    try {
      const book = await commands.importBook(path);
      set((state) => ({
        books: [...state.books, book],
        loading: false,
        importing: false,
      }));
      return book;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import book';
      set({ error: message, loading: false, importing: false });
      throw err;
    }
  },

  importBundle: async (path: string) => {
    set({ loading: true, importing: true, error: null });
    try {
      const book = await commands.importBundle(path);
      set((state) => ({
        books: [...state.books, book],
        loading: false,
        importing: false,
      }));
      return book;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import bundle';
      set({ error: message, loading: false, importing: false });
      throw err;
    }
  },

  deleteBook: async (id: BookId) => {
    set({ loading: true, error: null });
    try {
      await commands.deleteBook(id);
      set((state) => ({
        books: state.books.filter((book) => book.id !== id),
        loading: false,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete book';
      set({ error: message, loading: false });
      throw err;
    }
  },

  updateBook: (updatedBook: Book) => {
    set((state) => ({
      books: state.books.map((book) =>
        book.id === updatedBook.id ? updatedBook : book
      ),
    }));
  },

  clearError: () => {
    set({ error: null });
  },
}));

// =============================================================================
// Selectors
// =============================================================================

/**
 * Select books sorted by most recently opened
 */
export const selectRecentBooks = (state: LibraryStore): Book[] => {
  return [...state.books]
    .filter((book) => book.lastOpenedAt !== null)
    .sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0));
};

/**
 * Select books sorted by most recently added
 */
export const selectNewestBooks = (state: LibraryStore): Book[] => {
  return [...state.books].sort((a, b) => b.createdAt - a.createdAt);
};

/**
 * Select books that have narration ready
 */
export const selectBooksWithNarration = (state: LibraryStore): Book[] => {
  return state.books.filter((book) => book.narrationStatus === 'ready');
};

/**
 * Select books by narration status
 */
export const selectBooksByNarrationStatus = (
  state: LibraryStore,
  status: Book['narrationStatus']
): Book[] => {
  return state.books.filter((book) => book.narrationStatus === status);
};

/**
 * Select a single book by ID
 */
export const selectBookById = (state: LibraryStore, id: BookId): Book | undefined => {
  return state.books.find((book) => book.id === id);
};
