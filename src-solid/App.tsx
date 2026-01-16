/**
 * App Shell (Solid)
 *
 * Main application component with SolidJS Router navigation.
 */

import { onMount, type JSX } from 'solid-js';
import { Router, Route, A, useLocation } from '@solidjs/router';
import { settingsStore } from './stores/settingsStore';
import { libraryStore } from './stores/libraryStore';
import { LibraryView, ReaderView, GeneratorView, SettingsView } from './views';

// =============================================================================
// Styles
// =============================================================================

const styles = {
  app: {
    display: 'flex',
    'flex-direction': 'column',
    height: '100vh',
    width: '100vw',
    'background-color': 'var(--bg-primary)',
    color: 'var(--text-primary)',
  } as JSX.CSSProperties,
  nav: {
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'space-between',
    padding: '12px 24px',
    'border-bottom': '1px solid var(--border-color)',
    'background-color': 'var(--bg-secondary)',
    'flex-shrink': '0',
  } as JSX.CSSProperties,
  logo: {
    'font-size': '20px',
    'font-weight': '700',
    color: 'var(--text-primary)',
    'text-decoration': 'none',
  } as JSX.CSSProperties,
  navLinks: {
    display: 'flex',
    gap: '8px',
  } as JSX.CSSProperties,
  navLink: {
    padding: '8px 16px',
    'border-radius': '6px',
    'text-decoration': 'none',
    'font-size': '14px',
    'font-weight': '500',
    color: 'var(--text-secondary)',
    transition: 'background-color 0.2s, color 0.2s',
  } as JSX.CSSProperties,
  navLinkActive: {
    'background-color': 'var(--bg-accent)',
    color: 'var(--text-accent)',
  } as JSX.CSSProperties,
  main: {
    flex: '1',
    overflow: 'auto',
  } as JSX.CSSProperties,
};

// =============================================================================
// Navigation Component
// =============================================================================

function Navigation() {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <nav style={styles.nav}>
      <A href="/library" style={styles.logo}>
        Actual Reader
      </A>
      <div style={styles.navLinks}>
        <A
          href="/library"
          style={{
            ...styles.navLink,
            ...(isActive('/library') ? styles.navLinkActive : {}),
          }}
        >
          Library
        </A>
        <A
          href="/generator"
          style={{
            ...styles.navLink,
            ...(isActive('/generator') ? styles.navLinkActive : {}),
          }}
        >
          Generator
        </A>
        <A
          href="/settings"
          style={{
            ...styles.navLink,
            ...(isActive('/settings') ? styles.navLinkActive : {}),
          }}
        >
          Settings
        </A>
      </div>
    </nav>
  );
}

// =============================================================================
// Layout Components
// =============================================================================

function MainLayout(props: { children: JSX.Element }) {
  return (
    <div style={styles.app}>
      <Navigation />
      <main style={styles.main}>{props.children}</main>
    </div>
  );
}

function ReaderLayout(props: { children: JSX.Element }) {
  return <div style={styles.app}>{props.children}</div>;
}

// =============================================================================
// App Component
// =============================================================================

function App() {
  onMount(() => {
    settingsStore.loadSettings().catch(console.error);
    libraryStore.fetchLibrary().catch(console.error);
  });

  return (
    <Router>
      {/* Reader has its own layout (no navigation) */}
      <Route path="/read/:bookId" component={() => (
        <ReaderLayout>
          <ReaderView />
        </ReaderLayout>
      )} />

      {/* Other views have the main navigation */}
      <Route path="/library" component={() => (
        <MainLayout>
          <LibraryView />
        </MainLayout>
      )} />
      <Route path="/generator" component={() => (
        <MainLayout>
          <GeneratorView />
        </MainLayout>
      )} />
      <Route path="/settings" component={() => (
        <MainLayout>
          <SettingsView />
        </MainLayout>
      )} />

      {/* Default redirect */}
      <Route path="/" component={() => {
        window.location.href = '/library';
        return null;
      }} />
      <Route path="*" component={() => {
        window.location.href = '/library';
        return null;
      }} />
    </Router>
  );
}

export default App;
