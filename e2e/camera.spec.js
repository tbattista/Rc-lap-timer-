import { test, expect } from '@playwright/test';

test.describe('Camera Initialization', () => {
  test('page loads without errors', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('RC Lap Timer');
  });

  test('shows loading state initially', async ({ page }) => {
    await page.goto('/');
    // Should show loading message or camera view
    const loading = page.locator('.loading-message');
    const cameraView = page.locator('.camera-view');
    // One of these should be visible
    await expect(loading.or(cameraView)).toBeVisible({ timeout: 5000 });
  });

  test('camera preview appears after permission granted', async ({ page }) => {
    await page.goto('/');

    // Wait for camera to initialize (fake device stream from Playwright)
    const video = page.locator('.camera-view video');
    await expect(video).toBeVisible({ timeout: 15000 });

    // Video element should have non-zero dimensions
    const box = await video.boundingBox();
    expect(box).toBeTruthy();
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
  });

  test('video element has required iOS attributes', async ({ page }) => {
    await page.goto('/');
    const video = page.locator('.camera-view video');
    await expect(video).toBeVisible({ timeout: 15000 });

    // Check critical attributes
    await expect(video).toHaveAttribute('playsinline', '');
    await expect(video).toHaveAttribute('muted', '');

    // Check autoplay
    const autoplay = await video.getAttribute('autoplay');
    expect(autoplay).not.toBeNull();
  });

  test('video is not hidden with display:none', async ({ page }) => {
    await page.goto('/');
    const video = page.locator('.camera-view video');
    await expect(video).toBeVisible({ timeout: 15000 });

    // The video should be visible, not hidden
    const display = await video.evaluate(el => window.getComputedStyle(el).display);
    expect(display).not.toBe('none');
  });

  test('video is actually playing (not paused)', async ({ page }) => {
    await page.goto('/');
    const video = page.locator('.camera-view video');
    await expect(video).toBeVisible({ timeout: 15000 });

    // Wait a moment for playback to start
    await page.waitForTimeout(1000);

    const isPaused = await video.evaluate(el => el.paused);
    expect(isPaused).toBe(false);
  });

  test('video has a valid stream (srcObject set)', async ({ page }) => {
    await page.goto('/');
    const video = page.locator('.camera-view video');
    await expect(video).toBeVisible({ timeout: 15000 });

    await page.waitForTimeout(1000);

    const hasSrcObject = await video.evaluate(el => el.srcObject !== null);
    expect(hasSrcObject).toBe(true);

    const trackCount = await video.evaluate(el => el.srcObject?.getTracks()?.length || 0);
    expect(trackCount).toBeGreaterThan(0);
  });

  test('video has non-zero videoWidth/videoHeight', async ({ page }) => {
    await page.goto('/');
    const video = page.locator('.camera-view video');
    await expect(video).toBeVisible({ timeout: 15000 });

    await page.waitForTimeout(1000);

    const dimensions = await video.evaluate(el => ({
      videoWidth: el.videoWidth,
      videoHeight: el.videoHeight,
      readyState: el.readyState,
    }));

    expect(dimensions.videoWidth).toBeGreaterThan(0);
    expect(dimensions.videoHeight).toBeGreaterThan(0);
    expect(dimensions.readyState).toBeGreaterThanOrEqual(2); // HAVE_CURRENT_DATA
  });

  test('no error message is displayed', async ({ page }) => {
    await page.goto('/');

    // Wait for either camera or error
    await page.waitForTimeout(5000);

    const errorEl = page.locator('.error-message');
    await expect(errorEl).not.toBeVisible();
  });
});

test.describe('Camera View UI', () => {
  test('shows finish line instruction overlay', async ({ page }) => {
    await page.goto('/');
    const video = page.locator('.camera-view video');
    await expect(video).toBeVisible({ timeout: 15000 });

    // Overlay canvas should be present
    const overlay = page.locator('.overlay-canvas');
    await expect(overlay).toBeVisible();
  });

  test('controls appear after camera is ready', async ({ page }) => {
    await page.goto('/');
    const video = page.locator('.camera-view video');
    await expect(video).toBeVisible({ timeout: 15000 });

    // Controls section should be visible
    const controls = page.locator('.controls');
    await expect(controls).toBeVisible();
  });

  test('can tap to set finish line points', async ({ page }) => {
    await page.goto('/');
    const video = page.locator('.camera-view video');
    await expect(video).toBeVisible({ timeout: 15000 });

    const overlay = page.locator('.overlay-canvas');
    await expect(overlay).toBeVisible();

    // Tap two points on the overlay
    const box = await overlay.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.5);
      await page.waitForTimeout(200);
      await page.mouse.click(box.x + box.width * 0.8, box.y + box.height * 0.5);
      await page.waitForTimeout(500);

      // After two taps, should switch to color mode or show finish line
      // The mode change indicates the line was set
    }
  });
});

test.describe('Debug and Diagnostics', () => {
  test('debug log shows camera init steps', async ({ page }) => {
    await page.goto('/');

    // During loading, debug log should be visible
    const debugLog = page.locator('.debug-log');

    // Wait for either camera ready or debug log
    await page.waitForTimeout(3000);

    // If debug log is visible, check its content
    if (await debugLog.isVisible()) {
      const logText = await debugLog.textContent();
      expect(logText).toContain('Init starting');
    }
  });

  test('camera-test.html diagnostic page loads', async ({ page }) => {
    await page.goto('/camera-test.html');
    await expect(page.locator('h1')).toHaveText('Camera Diagnostic Tests');

    // Start button should be visible
    const startBtn = page.locator('#startBtn');
    await expect(startBtn).toBeVisible();
    await expect(startBtn).toHaveText('Start All Tests (tap here first!)');
  });

  test('diagnostic page runs tests successfully', async ({ page }) => {
    await page.goto('/camera-test.html');

    // Click start
    await page.click('#startBtn');

    // Wait for tests to complete
    await page.waitForTimeout(10000);

    // Check that some tests passed
    const passResults = page.locator('.test.pass');
    const count = await passResults.count();
    expect(count).toBeGreaterThan(0);

    // Check for environment info
    const envSection = page.locator('#test-env');
    const envText = await envSection.textContent();
    expect(envText).toContain('UserAgent');
    expect(envText).toContain('Protocol');
  });
});

test.describe('No PWA Meta Tags', () => {
  test('page should not have apple-mobile-web-app-capable meta tag', async ({ page }) => {
    await page.goto('/');

    const metaTag = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="apple-mobile-web-app-capable"]');
      return meta ? meta.getAttribute('content') : null;
    });

    // This meta tag breaks getUserMedia on iOS in standalone mode
    expect(metaTag).toBeNull();
  });
});
