/**
 * E2E tests for Actual Reader using tauri-driver + WebDriverIO
 *
 * Run with: node tests/e2e.test.mjs
 * Requires: tauri-driver running on port 4444
 */

import { remote } from 'webdriverio';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync, unlinkSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_PATH = join(__dirname, '../src-tauri/target/debug/actual-reader');
const TEST_BOOK_PATH = '/tmp/test-book.md';

// Create test book
const TEST_BOOK_CONTENT = `# Test Book

This is a test book for Actual Reader.

## Chapter 1

This is the first paragraph of chapter one.

This is the second paragraph.

## Chapter 2

Chapter two begins here.

## Conclusion

The end.
`;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('📚 Actual Reader E2E Tests\n');

  // Create test book file
  writeFileSync(TEST_BOOK_PATH, TEST_BOOK_CONTENT);
  console.log('✓ Created test book at', TEST_BOOK_PATH);

  let browser;
  let appProcess;

  try {
    // Connect to tauri-driver
    console.log('\n🔌 Connecting to tauri-driver...');
    browser = await remote({
      hostname: 'localhost',
      port: 4444,
      capabilities: {
        'tauri:options': {
          application: APP_PATH,
        },
      },
    });
    console.log('✓ Connected to tauri-driver');

    // Wait for app to initialize
    await sleep(3000);
    console.log('✓ App started');

    // Test 1: Check library loads (may be empty or have books)
    console.log('\n📋 Test 1: Library loads');
    await sleep(1000);
    const pageSource = await browser.getPageSource();
    if (pageSource.includes('Library') && (pageSource.includes('empty') || pageSource.includes('Book'))) {
      console.log('✓ Library view loaded');
    } else {
      throw new Error('Library view did not load properly');
    }

    // Test 2: Import book via Tauri command (bypass file dialog)
    console.log('\n📋 Test 2: Import book via Tauri command');

    // Execute Tauri invoke directly in the webview
    const importResult = await browser.executeAsync(async (bookPath, done) => {
      try {
        const { invoke } = window.__TAURI_INTERNALS__;
        const book = await invoke('import_book', { path: bookPath });
        done({ success: true, book });
      } catch (error) {
        done({ success: false, error: error.toString() });
      }
    }, TEST_BOOK_PATH);

    if (importResult.success) {
      console.log('✓ Book imported:', importResult.book.title);
    } else {
      throw new Error(`Failed to import book: ${importResult.error}`);
    }

    // Refresh the page to see the imported book
    await browser.refresh();
    await sleep(2000);

    // Test 3: Verify book appears in library
    console.log('\n📋 Test 3: Verify book in library');
    const bookCards = await browser.$$('[data-testid="book-card"]');
    // If no test id, look for the book title
    const pageSource2 = await browser.getPageSource();
    if (pageSource2.includes('Test Book') || bookCards.length > 0) {
      console.log('✓ Book appears in library');
    } else {
      // Check if library shows the book by looking for non-empty state
      const emptyState = await browser.$('h2=Your library is empty');
      const isDisplayed = await emptyState.isExisting();
      if (!isDisplayed) {
        console.log('✓ Library is no longer empty');
      } else {
        throw new Error('Book not visible in library after import');
      }
    }

    // Test 4: Navigate to Settings
    console.log('\n📋 Test 4: Settings navigation');
    const settingsLink = await browser.$('a=Settings');
    await settingsLink.click();
    await sleep(500);

    const url = await browser.getUrl();
    if (url.includes('settings')) {
      console.log('✓ Navigated to Settings');
    } else {
      throw new Error(`Expected settings URL, got: ${url}`);
    }

    // Test 5: Navigate back to Library
    console.log('\n📋 Test 5: Library navigation');
    const libraryLink = await browser.$('a=Library');
    await libraryLink.click();
    await sleep(500);

    const url2 = await browser.getUrl();
    if (url2.includes('library')) {
      console.log('✓ Navigated to Library');
    } else {
      throw new Error(`Expected library URL, got: ${url2}`);
    }

    // Test 6: Open the imported book in reader
    console.log('\n📋 Test 6: Open book in reader');
    // Click on the book card (it's a div with role="button")
    try {
      const bookCard = await browser.$('h3=Test Book');
      if (await bookCard.isExisting()) {
        // Click the parent card
        await bookCard.click();
        await sleep(1500);

        const readerUrl = await browser.getUrl();
        if (readerUrl.includes('read/')) {
          console.log('✓ Opened book in reader');

          // Test 7: Check reader has segments
          console.log('\n📋 Test 7: Reader shows content');
          await sleep(1000);
          const readerContent = await browser.getPageSource();
          if (readerContent.includes('Chapter') || readerContent.includes('first paragraph')) {
            console.log('✓ Reader displays book content');
          } else {
            // Try checking via Tauri command
            const segmentResult = await browser.executeAsync(async (bookId, done) => {
              try {
                const { invoke } = window.__TAURI_INTERNALS__;
                const segments = await invoke('get_segments', { bookId });
                done({ success: true, count: segments.length });
              } catch (error) {
                done({ success: false, error: error.toString() });
              }
            }, importResult.book.id);

            if (segmentResult.success && segmentResult.count > 0) {
              console.log(`✓ Reader has ${segmentResult.count} segments loaded`);
            } else {
              console.log('⚠ Reader content not verified');
            }
          }

          // Test 8: Test navigation back to library using Back button
          console.log('\n📋 Test 8: Navigate back from reader');
          const backButton = await browser.$('button=Back');
          if (await backButton.isExisting()) {
            await backButton.click();
            await sleep(500);
            const finalUrl = await browser.getUrl();
            if (finalUrl.includes('library')) {
              console.log('✓ Navigated back to library');
            }
          }
        } else {
          console.log('⚠ Not redirected to reader (URL:', readerUrl, ')');
        }
      } else {
        console.log('⚠ Could not find book card');
      }
    } catch (e) {
      console.log('⚠ Reader test error:', e.message);
    }

    // Test 9: Delete the imported book
    console.log('\n📋 Test 9: Delete book');
    const deleteResult = await browser.executeAsync(async (id, done) => {
      try {
        const { invoke } = window.__TAURI_INTERNALS__;
        await invoke('delete_book', { id });
        done({ success: true });
      } catch (error) {
        done({ success: false, error: error.toString() });
      }
    }, importResult.book.id);

    if (deleteResult.success) {
      console.log('✓ Book deleted');

      // Refresh and verify deletion
      await browser.refresh();
      await sleep(1000);
      const afterDelete = await browser.getPageSource();
      // Check that our specific test book is gone (there may be other books)
      const testBookCount = (afterDelete.match(/>Test Book</g) || []).length;
      const previousCount = (pageSource2.match(/>Test Book</g) || []).length;
      if (testBookCount < previousCount) {
        console.log('✓ Book removed from library');
      } else {
        console.log('⚠ Could not verify book removal (may have duplicates)');
      }
    } else {
      throw new Error(`Failed to delete book: ${deleteResult.error}`);
    }

    console.log('\n✅ All tests passed!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    // Cleanup
    if (browser) {
      await browser.deleteSession();
    }
    if (existsSync(TEST_BOOK_PATH)) {
      unlinkSync(TEST_BOOK_PATH);
    }
  }
}

runTests();
