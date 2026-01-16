/**
 * React hook for sync state management
 *
 * Manages sync server state, listens to sync events from backend,
 * and provides methods to start/stop server and sync with peers.
 *
 * Uses GLOSSARY.md terminology throughout.
 */

import { useState, useEffect, useCallback } from 'react';
import { useLibraryStore } from '../stores/libraryStore';
import {
  EventSubscriptionManager,
  onSyncDiscovered,
  onSyncProgress,
} from '../tauri/events';
import * as commands from '../tauri/commands';
import type { SyncServer, SyncResult } from '../types';

// =============================================================================
// Types
// =============================================================================

interface SyncProgress {
  /** Sync progress percentage (0-100) */
  percent: number;
}

interface UseSyncReturn {
  /** Discovered sync servers on the network */
  servers: SyncServer[];
  /** Whether sync is currently in progress */
  syncing: boolean;
  /** Current sync progress, null if not syncing */
  progress: SyncProgress | null;
  /** Whether the local sync server is running */
  serverRunning: boolean;
  /** Error from last failed operation */
  error: string | null;
  /** Start the local sync server */
  startServer: () => Promise<void>;
  /** Stop the local sync server */
  stopServer: () => Promise<void>;
  /** Manually discover sync servers on the network */
  discoverServers: () => Promise<SyncServer[]>;
  /** Sync with a specific server */
  syncWith: (server: SyncServer) => Promise<SyncResult>;
  /** Clear discovered servers list */
  clearServers: () => void;
  /** Clear any error state */
  clearError: () => void;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook for managing sync operations
 *
 * Automatically subscribes to sync events from the backend
 * and cleans up on unmount.
 *
 * @example
 * ```tsx
 * function SyncPanel() {
 *   const {
 *     servers,
 *     syncing,
 *     progress,
 *     serverRunning,
 *     startServer,
 *     stopServer,
 *     discoverServers,
 *     syncWith
 *   } = useSync();
 *
 *   return (
 *     <div>
 *       <button onClick={serverRunning ? stopServer : startServer}>
 *         {serverRunning ? 'Stop Server' : 'Start Server'}
 *       </button>
 *
 *       <button onClick={discoverServers}>Find Devices</button>
 *
 *       {servers.map(server => (
 *         <div key={server.address}>
 *           <span>{server.name}</span>
 *           <button onClick={() => syncWith(server)}>Sync</button>
 *         </div>
 *       ))}
 *
 *       {syncing && progress && (
 *         <ProgressBar value={progress.percent} />
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useSync(): UseSyncReturn {
  // Local state
  const [servers, setServers] = useState<SyncServer[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [serverRunning, setServerRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Access library store for refreshing after sync
  const fetchLibrary = useLibraryStore((state) => state.fetchLibrary);

  // Subscribe to backend events
  useEffect(() => {
    const manager = new EventSubscriptionManager();

    // Set up event listeners
    const setupListeners = async () => {
      // Server discovered on network (via mDNS)
      await manager.add(
        onSyncDiscovered((payload) => {
          setServers((prev) => {
            // Avoid duplicates by checking address
            const exists = prev.some(
              (s) => s.address === payload.server.address && s.port === payload.server.port
            );
            if (exists) {
              return prev;
            }
            return [...prev, payload.server];
          });
        })
      );

      // Sync progress updates
      await manager.add(
        onSyncProgress((payload) => {
          setProgress({ percent: payload.percent });
          setSyncing(true);
        })
      );
    };

    setupListeners();

    // Cleanup on unmount
    return () => {
      manager.unlistenAll();
    };
  }, []);

  // Start the local sync server
  const startServer = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      await commands.startSyncServer();
      setServerRunning(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start sync server';
      setError(message);
      throw err;
    }
  }, []);

  // Stop the local sync server
  const stopServer = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      await commands.stopSyncServer();
      setServerRunning(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to stop sync server';
      setError(message);
      throw err;
    }
  }, []);

  // Manually discover sync servers
  const discoverServers = useCallback(async (): Promise<SyncServer[]> => {
    setError(null);
    try {
      const discovered = await commands.discoverSyncServers();
      // Merge with existing servers, avoiding duplicates
      setServers((prev) => {
        const merged = [...prev];
        for (const server of discovered) {
          const exists = merged.some(
            (s) => s.address === server.address && s.port === server.port
          );
          if (!exists) {
            merged.push(server);
          }
        }
        return merged;
      });
      return discovered;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to discover servers';
      setError(message);
      throw err;
    }
  }, []);

  // Sync with a specific server
  const syncWith = useCallback(
    async (server: SyncServer): Promise<SyncResult> => {
      setError(null);
      setSyncing(true);
      setProgress({ percent: 0 });

      try {
        const result = await commands.syncWith(server);
        setSyncing(false);
        setProgress(null);

        // Refresh library to show any new books
        fetchLibrary();

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to sync';
        setError(message);
        setSyncing(false);
        setProgress(null);
        throw err;
      }
    },
    [fetchLibrary]
  );

  // Clear discovered servers
  const clearServers = useCallback((): void => {
    setServers([]);
  }, []);

  // Clear error
  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  return {
    servers,
    syncing,
    progress,
    serverRunning,
    error,
    startServer,
    stopServer,
    discoverServers,
    syncWith,
    clearServers,
    clearError,
  };
}
