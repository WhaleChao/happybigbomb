import { expect, test, type Page } from '@playwright/test';
import { makePhotos } from './fixtures';

const SHOT_DIR = 'docs/screenshots';

/** 確認整個流程沒有連到本機以外的任何網址 */
function trackExternalRequests(page: Page): string[] {
  const external: string[] = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname) && !['blob:', 'data:'].includes(url.protocol)) external.push(req.url());
  });
  return external;
}

async function expectNoHorizontalScroll(page: Page) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw, '不得出現整頁橫向捲動').toBeLessThanOrEqual(cw);
}

async function expectTouchTargets(page: Page) {
  const small = await page.evaluate(() => {
    const bad: string[] = [];
    document.querySelectorAll<HTMLElement>('button, [role="button"], a[href], label.swatch, .format').forEach((el) => {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || style.visibility === 'hidden') return;
      if (el.classList.contains('skip-link')) return;
      if (el.classList.contains('cell')) return; // 畫布格子大小由版面決定
      if (r.width < 40 || r.height < 40) bad.push(`${el.tagName}.${el.className} ${el.getAttribute('aria-label') ?? el.textContent?.trim()} ${Math.round(r.width)}×${Math.round(r.height)}`);
    });
    return bad;
  });
  expect(small, '觸控點擊區至少 40px').toEqual([]);
}

async function expectInputFontSize(page: Page) {
  const tooSmall = await page.evaluate(() =>
    Array.from(document.querySelectorAll('input, select, textarea'))
      .map((el) => parseFloat(getComputedStyle(el).fontSize))
      .filter((s) => s < 16),
  );
  expect(tooSmall, '輸入元件字級至少 16px').toEqual([]);
}

async function addPhotos(page: Page, count: number) {
  const photos = await makePhotos(page, count);
  await page.locator('.dropzone input[type="file"]').setInputFiles(photos);
  await expect(page.locator('.cell img.cell-media')).toHaveCount(count);
}

for (const scheme of ['light', 'dark'] as const) {
  test(`冒煙：空白狀態（${scheme}）`, async ({ page }, info) => {
    const external = trackExternalRequests(page);
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.goto('./');
    await expect(page.getByRole('heading', { name: '小皮大霹靂' })).toBeVisible();
    await expect(page.getByText('照片只在你的瀏覽器處理，不會上傳').first()).toBeAttached();
    await expect(page.locator('.cell')).toHaveCount(4);
    await expectNoHorizontalScroll(page);
    await expectTouchTargets(page);
    await expectInputFontSize(page);
    await page.screenshot({ path: `${SHOT_DIR}/${info.project.name}-empty-${scheme}.png` });
    expect(external).toEqual([]);
  });

  test(`冒煙：放入照片後（${scheme}）`, async ({ page }, info) => {
    const external = trackExternalRequests(page);
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.goto('./');
    await addPhotos(page, 4);
    await page.locator('.cell').nth(1).click();
    const mobile = info.project.name.startsWith('mobile');
    const tablet = info.project.name.startsWith('tablet');
    if (tablet) await page.getByRole('tab', { name: /調整/ }).click();
    if (!mobile) {
      await page.getByRole('radio', { name: '暖色' }).click();
      await expect(page.getByRole('radio', { name: '暖色' })).toHaveAttribute('aria-checked', 'true');
    }
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: `${SHOT_DIR}/${info.project.name}-filled-${scheme}.png` });
    if (mobile) {
      await page.getByRole('navigation', { name: '切換檢視' }).getByRole('button', { name: '調整' }).click();
      await page.getByRole('radio', { name: '暖色' }).click();
      await expectNoHorizontalScroll(page);
      await expectTouchTargets(page);
      await page.screenshot({ path: `${SHOT_DIR}/${info.project.name}-adjust-${scheme}.png` });
      await page.getByRole('navigation', { name: '切換檢視' }).getByRole('button', { name: '版面' }).click();
      await expectNoHorizontalScroll(page);
      await expectTouchTargets(page);
      await page.screenshot({ path: `${SHOT_DIR}/${info.project.name}-compose-${scheme}.png` });
    }
    expect(external).toEqual([]);
  });
}
