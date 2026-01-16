/**
 * Zustand stores
 *
 * Re-exports all stores and selectors for convenient importing.
 */

export {
  useLibraryStore,
  selectRecentBooks,
  selectNewestBooks,
  selectBooksWithNarration,
  selectBooksByNarrationStatus,
  selectBookById,
} from './libraryStore';

export {
  useReaderStore,
  selectCurrentSegment,
  selectCurrentMarker,
  selectHasNarration,
  selectTotalDuration,
  selectProgressPercent,
  selectSegmentProgressPercent,
} from './readerStore';

export {
  useSettingsStore,
  selectTheme,
  selectFontSettings,
  selectPlaybackSettings,
  selectDefaultVoice,
  selectHighlightColor,
  selectSyncPort,
} from './settingsStore';
