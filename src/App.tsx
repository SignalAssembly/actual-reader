/**
 * App Shell
 *
 * Main application component with React Router navigation.
 * Provides the app shell structure and routing between views.
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useSettingsStore } from './stores/settingsStore';
import { useLibraryStore } from './stores/libraryStore';
import LibraryView from './views/LibraryView';
import ReaderView from './views/ReaderView';
import GeneratorView from './views/GeneratorView';
import SettingsView from './views/SettingsView';

// =============================================================================
// Styles
// =============================================================================

const styles = {
  app: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100vh',
    width: '100vw',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 24px',
    borderBottom: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  logo: {
    fontSize: '20px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    textDecoration: 'none',
  },
  navLinks: {
    display: 'flex',
    gap: '8px',
  },
  navLink: {
    padding: '8px 16px',
    borderRadius: '6px',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    transition: 'background-color 0.2s, color 0.2s',
  },
  navLinkActive: {
    backgroundColor: 'var(--bg-accent)',
    color: 'var(--text-accent)',
  },
  main: {
    flex: 1,
    overflow: 'auto',
  },
};

// CSS Variables for theming
const cssVariables = `
  :root {
    --bg-primary: #ffffff;
    --bg-secondary: #f8f9fa;
    --bg-accent: #e7f0ff;
    --text-primary: #1a1a1a;
    --text-secondary: #666666;
    --text-accent: #2563eb;
    --border-color: #e5e7eb;
    --highlight-color: #ffeb3b;
    --success-color: #22c55e;
    --warning-color: #f59e0b;
    --error-color: #ef4444;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --bg-primary: #1a1a1a;
      --bg-secondary: #242424;
      --bg-accent: #1e3a5f;
      --text-primary: #f5f5f5;
      --text-secondary: #a3a3a3;
      --text-accent: #60a5fa;
      --border-color: #374151;
    }
  }

  body {
    margin: 0;
    padding: 0;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  *, *::before, *::after {
    box-sizing: border-box;
  }
`;

// =============================================================================
// Navigation Component
// =============================================================================

function Navigation() {
  return (
    <nav style={styles.nav}>
      <NavLink to="/library" style={styles.logo}>
        Actual Reader
      </NavLink>
      <div style={styles.navLinks}>
        <NavLink
          to="/library"
          style={({ isActive }) => ({
            ...styles.navLink,
            ...(isActive ? styles.navLinkActive : {}),
          })}
        >
          Library
        </NavLink>
        <NavLink
          to="/generator"
          style={({ isActive }) => ({
            ...styles.navLink,
            ...(isActive ? styles.navLinkActive : {}),
          })}
        >
          Generator
        </NavLink>
        <NavLink
          to="/settings"
          style={({ isActive }) => ({
            ...styles.navLink,
            ...(isActive ? styles.navLinkActive : {}),
          })}
        >
          Settings
        </NavLink>
      </div>
    </nav>
  );
}

// =============================================================================
// App Component
// =============================================================================

function App() {
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const fetchLibrary = useLibraryStore((state) => state.fetchLibrary);

  // Load settings and library on mount
  useEffect(() => {
    loadSettings().catch(console.error);
    fetchLibrary().catch(console.error);
  }, [loadSettings, fetchLibrary]);

  return (
    <BrowserRouter>
      <style>{cssVariables}</style>
      <div style={styles.app}>
        <Routes>
          {/* Reader has its own navigation */}
          <Route path="/read/:bookId" element={<ReaderView />} />

          {/* Other views have the main navigation */}
          <Route
            path="*"
            element={
              <>
                <Navigation />
                <main style={styles.main}>
                  <Routes>
                    <Route path="/library" element={<LibraryView />} />
                    <Route path="/generator" element={<GeneratorView />} />
                    <Route path="/settings" element={<SettingsView />} />
                    <Route path="/" element={<Navigate to="/library" replace />} />
                    <Route path="*" element={<Navigate to="/library" replace />} />
                  </Routes>
                </main>
              </>
            }
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
