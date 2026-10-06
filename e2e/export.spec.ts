import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { makeGif, makePhotos, makeVideo } from './fixtures';

async function addPhotos(page: Page, count: number) {
  const photos = await makePhotos(page, count);
  await page.locator('.dropzone input[type="file"]').setInputFiles(photos);
  await expect(page.locator('.cell img.cell-media')).toHaveCount(count);
}

async function runExport(page: Page) {
  const downloadPromise = page.waitForEvent('download', { timeout: 110_000 });
  await page.getByRole('button', { name: /開始匯出|再匯出一次/ }).click();
  const download = await downloadPromise;
  const path = await download.path();
  return { name: download.suggestedFilename(), bytes: await readFile(path) };
}

test('PNG：輸出尺寸固定、與螢幕大小無關', async ({ page }) => {
  await page.goto('./');
  await addPhotos(page, 4);
  await page.getByRole('button', { name: '匯出作品' }).click();
  await expect(page.getByRole('dialog', { name: '匯出作品' })).toBeVisible();
  const { name, bytes } = await runExport(page);
  expect(name).toMatch(/^happybigbomb-\d{8}-\d{6}\.png$/);
  expect(bytes.subarray(1, 4).toString('latin1')).toBe('PNG');
  expect(bytes.readUInt32BE(16)).toBe(1080);
  expect(bytes.readUInt32BE(20)).toBe(1920);
  await expect(page.getByText('已開始下載')).toBeVisible();
});

test('GIF：放入動圖後可以匯出循環 GIF', async ({ page }) => {
  await page.goto('./');
  await addPhotos(page, 3);
  await page.locator('.cell').nth(3).click();
  // 點空白格子會開啟檔案選擇器
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.cell').nth(3).click();
  await (await chooser).setFiles(makeGif());
  await expect(page.locator('.cell').nth(3).locator('img')).toBeVisible();
  await page.getByRole('button', { name: '匯出作品' }).click();
  await expect(page.getByRole('radio', { name: /GIF 動圖/ })).toBeChecked();
  const { bytes } = await runExport(page);
  expect(bytes.subarray(0, 6).toString('latin1')).toBe('GIF89a');
  expect(bytes.readUInt16LE(6)).toBe(405);
  expect(bytes.readUInt16LE(8)).toBe(720);
  expect(bytes.includes(Buffer.from('NETSCAPE2.0'))).toBe(true);
});

test('MP4：支援 H.264 的瀏覽器可匯出；不支援時清楚說明', async ({ page }) => {
  await page.goto('./');
  const video = await makeVideo(page);
  test.skip(!video, '這個瀏覽器無法產生測試影片');
  await addPhotos(page, 1);
  await page.locator('.dropzone input[type="file"]').setInputFiles([video!]);
  await expect(page.locator('.cell video')).toHaveCount(1);
  await page.getByRole('button', { name: '匯出作品' }).click();
  const mp4 = page.getByRole('radio', { name: /MP4 影片/ });
  await expect(page.getByText('正在確認瀏覽器是否支援…')).toHaveCount(0);
  if (await mp4.isDisabled()) {
    await expect(page.getByText(/這個瀏覽器無法製作 MP4/)).toBeVisible();
    await expect(page.getByRole('radio', { name: /GIF 動圖/ })).toBeChecked();
    test.info().annotations.push({ type: 'note', description: '此瀏覽器沒有 H.264 編碼器，已驗證會改用 GIF 並說明原因' });
    return;
  }
  await expect(mp4).toBeChecked();
  const { bytes } = await runExport(page);
  expect(bytes.subarray(4, 8).toString('latin1')).toBe('ftyp');
  expect(bytes.includes(Buffer.from('moov'))).toBe(true);
});

test('鍵盤：Tab 到空白格子按 Enter 開啟選檔，方向鍵可移動照片', async ({ page }) => {
  await page.goto('./');
  await addPhotos(page, 1);
  const first = page.locator('.cell').first();
  await first.focus();
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  const before = await first.locator('img').evaluate((el) => (el as HTMLElement).style.left);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Shift+ArrowRight');
  const after = await first.locator('img').evaluate((el) => (el as HTMLElement).style.left);
  expect(after).not.toBe(before);
  await page.keyboard.press('+');
  await expect(page.getByRole('slider', { name: '縮放' })).toHaveValue('105');

  const second = page.locator('.cell').nth(1);
  await second.focus();
  const chooser = page.waitForEvent('filechooser');
  await page.keyboard.press('Enter');
  expect(await chooser).toBeTruthy();
});

test('錯誤訊息：選到不支援的檔案時說明原因與解法', async ({ page }) => {
  await page.goto('./');
  await page.locator('.dropzone input[type="file"]').setInputFiles({ name: '報告.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('「報告.pdf」不是照片或影片');
  await expect(alert).toContainText('請選擇 JPG、PNG');
});

test('記憶體：更換或移除檔案後，舊的 object URL 會被釋放', async ({ page }) => {
  await page.goto('./');
  await addPhotos(page, 1);
  const cell = page.locator('.cell').first();
  const oldUrl = await cell.locator('img').getAttribute('src');
  await cell.click();
  await page.getByRole('button', { name: '移除第 1 格的檔案' }).click();
  await expect(cell.locator('img')).toHaveCount(0);
  const stillAlive = await page.evaluate(async (u) => {
    try {
      await fetch(u!);
      return true;
    } catch {
      return false;
    }
  }, oldUrl);
  expect(stillAlive).toBe(false);
});

test('嵌入：在 iframe 中運作並以 postMessage 回報高度', async ({ page, baseURL }) => {
  // 以不同網域的宿主頁面載入，模擬接入方的「免登入公開工具」頁
  // 以不同連接埠當宿主（不同源），模擬跨網域嵌入；頁面由 route 直接提供，不需另開伺服器
  const hostUrl = 'http://localhost:4999/embed-host.html';
  await page.route(hostUrl, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><body style="margin:0">
      <script>window.heights=[];addEventListener('message',e=>{if(e.data&&e.data.type==='happybigbomb:height')heights.push(e.data.height)})</script>
      <iframe id="f" src="${baseURL}?embed=1&parentOrigin=${new URL(hostUrl).origin}" style="width:1200px;height:400px;border:0"></iframe></body>`,
    }),
  );
  await page.goto(hostUrl);
  await expect.poll(() => page.evaluate(() => (window as unknown as { heights: number[] }).heights.length)).toBeGreaterThan(0);
  const h = await page.evaluate(() => (window as unknown as { heights: number[] }).heights.at(-1)!);
  expect(h).toBeGreaterThan(700);
  const frame = page.frameLocator('#f');
  await expect(frame.getByRole('heading', { name: '小皮大霹靂' })).toBeVisible();
  await expect(frame.getByRole('button', { name: /清除離線快取/ })).toHaveCount(0);
});
