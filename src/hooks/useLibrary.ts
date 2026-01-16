/**
 * React hook for library state management
 *
 * Wrapper around libraryStore that provides a convenient interface
 * for components and handles initial data fetching on mount.
 *
 * Uses GLOSSARY.md terminology: "library" not "catalog", "book" not "document"
 */

import { useEffect, useCallback } from 'react';
import {
  useLibraryStore,
  selectRecentBooks,
  selectNewestBooks,
  selectBooksWithNarration,
  selectBooksByNarrationStatus,
  selectBookById,
} from '../stores/libraryStore';
import type { Book, BookId, NarrationStatus } from '../types';

// =============================================================================
// Hook Return Type
// =============================================================================

interface UseLibraryReturn {
  /** All books in the library */
  books: Book[];
  /** Loading state for async operations */
  loading: boolean;
  /** Error message from last failed operation */
  error: string | null;
  /** Import a book from a source file path */
  importBook: (path: string) => Promise<Book>;
  /** Import a .actualbook bundle */
  importBundle: (path: string) => Promise<Book>;
  /** Delete a book from the library */
  deleteBook: (id: BookId) => Promise<void>;
  /** Refresh the library from backend */
  refreshLibrary: () => Promise<void>;
  /** Clear any error state */
  clearError: () => void;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook for managing the book library
 *
 * Automatically fetches the library on mount and provides methods
 * for importing, deleting, and refreshing books.
 *
 * @example
 * ```tsx
 * function LibraryView() {
 *   const { books, loading, error, importBook, deleteBook, refreshLibrary } = useLibrary();
 *
 *   if (loading) return <Loading />;
 *   if (error) return <Error message={error} />;
 *
 *   return (
 *     <div>
 *       {books.map(book => (
 *         <BookCard
 *           key={book.id}
 *           book={book}
 *           onDelete={() => deleteBook(book.id)}
 *         />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useLibrary(): UseLibraryReturn {
  // Get state and actions from store
  const books = useLibraryStore((state) => state.books);
  const loading = useLibraryStore((state) => state.loading);
  const error = useLibraryStore((state) => state.error);
  const fetchLibrary = useLibraryStore((state) => state.fetchLibrary);
  const storeImportBook = useLibraryStore((state) => state.importBook);
  const storeImportBundle = useLibraryStore((state) => state.importBundle);
  const storeDeleteBook = useLibraryStore((state) => state.deleteBook);
  const storeClearError = useLibraryStore((state) => state.clearError);

  // Fetch library on mount
  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  // Stable callbacks
  const importBook = useCallback(
    async (path: string): Promise<Book> => {
      return storeImportBook(path);
    },
    [storeImportBook]
  );

  const importBundle = useCallback(
    async (path: string): Promise<Book> => {
      return storeImportBundle(path);
    },
    [storeImportBundle]
  );

  const deleteBook = useCallback(
    async (id: BookId): Promise<void> => {
      return storeDeleteBook(id);
    },
    [storeDeleteBook]
  );

  const refreshLibrary = useCallback(async (): Promise<void> => {
    return fetchLibrary();
  }, [fetchLibrary]);

  const clearError = useCallback((): void => {
    storeClearError();
  }, [storeClearError]);

  return {
    books,
    loading,
    error,
    importBook,
    importBundle,
    deleteBook,
    refreshLibrary,
    clearError,
  };
}

// =============================================================================
// Selector Hooks
// =============================================================================

/**
 * Hook to get books sorted by most recently opened
 */
export function useRecentBooks(): Book[] {
  return useLibraryStore(selectRecentBooks);
}

/**
 * Hook to get books sorted by most recently added
 */
export function useNewestBooks(): Book[] {
  return useLibraryStore(selectNewestBooks);
}

/**
 * Hook to get books that have narration ready
 */
export function useBooksWithNarration(): Book[] {
  return useLibraryStore(selectBooksWithNarration);
}

/**
 * Hook to get books by narration status
 */
export function useBooksByNarrationStatus(status: NarrationStatus): Book[] {
  return useLibraryStore((state) => selectBooksByNarrationStatus(state, status));
}

/**
 * Hook to get a single book by ID
 */
export function useBookById(id: BookId): Book | undefined {
  return useLibraryStore((state) => selectBookById(state, id));
}
