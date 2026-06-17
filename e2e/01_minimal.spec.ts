import { expect, test, type Page } from '@playwright/test';

test.use({ baseURL: `http://localhost:${process.env.E2E_PORT_01_MINIMAL}` });

async function waitForHydration(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(
    () =>
      Object.getOwnPropertyNames(document.body).some((k) =>
        k.startsWith('__reactFiber'),
      ),
    null,
    { timeout: 60_000 },
  );
}

test('server render cache + opt-in etag skip + invalidation', async ({
  page,
  browser,
}) => {
  await page.goto('/');
  await waitForHydration(page);
  await expect(page.getByTestId('home-heading')).toBeVisible();

  // 1) First navigation to /cached: the element is sent over the wire.
  const firstRsc = page.waitForResponse('**/RSC/R/cached.txt**');
  await page.getByTestId('to-cached').click();
  const firstBody = await (await firstRsc).text();
  await expect(page.getByTestId('cached-content')).toHaveText(
    'cached render #1',
  );
  expect(firstBody).toContain('cached-content');

  // 1b) A fresh client (no etags) is served the element from the server render
  //     cache: the count stays at #1, proving the stored RSC payload was
  //     replayed rather than re-rendered.
  const freshContext = await browser.newContext();
  const freshPage = await freshContext.newPage();
  await freshPage.goto('/cached');
  await waitForHydration(freshPage);
  await expect(freshPage.getByTestId('cached-content')).toHaveText(
    'cached render #1',
  );
  await freshContext.close();

  // 2) Navigate away and back: the etag still matches, so the element is
  //    omitted from the wire yet still rendered from the client's cache.
  await page.getByTestId('to-home').click();
  await expect(page.getByTestId('home-heading')).toBeVisible();
  const secondRsc = page.waitForResponse('**/RSC/R/cached.txt**');
  await page.getByTestId('to-cached').click();
  const secondBody = await (await secondRsc).text();
  await expect(page.getByTestId('cached-content')).toHaveText(
    'cached render #1',
  );
  expect(secondBody).not.toContain('cached-content');

  // 3) Invalidate the cache (bumps the etag): the element is re-sent and
  //    re-rendered.
  await page.getByTestId('to-home').click();
  await expect(page.getByTestId('home-heading')).toBeVisible();
  const invalidation = await page.request.get('/invalidate');
  expect(invalidation.ok()).toBe(true);
  const thirdRsc = page.waitForResponse('**/RSC/R/cached.txt**');
  await page.getByTestId('to-cached').click();
  const thirdBody = await (await thirdRsc).text();
  await expect(page.getByTestId('cached-content')).toHaveText(
    'cached render #2',
  );
  expect(thirdBody).toContain('cached-content');
});

test('the etag tracks TTL: skipped while fresh, re-sent after expiry', async ({
  page,
}) => {
  await page.goto('/');
  await waitForHydration(page);
  await expect(page.getByTestId('home-heading')).toBeVisible();

  // First navigation: the element is sent and rendered (#1).
  const firstRsc = page.waitForResponse('**/RSC/R/cached-ttl.txt**');
  await page.getByTestId('to-cached-ttl').click();
  const firstBody = await (await firstRsc).text();
  await expect(page.getByTestId('cached-ttl-content')).toHaveText(
    'cached-ttl render #1',
  );
  expect(firstBody).toContain('cached-ttl-content');

  // Navigate away and back immediately (within the TTL): the entry is still
  // fresh, so the etag matches and the element is omitted from the wire.
  await page.getByTestId('ttl-to-home').click();
  await expect(page.getByTestId('home-heading')).toBeVisible();
  const freshRsc = page.waitForResponse('**/RSC/R/cached-ttl.txt**');
  await page.getByTestId('to-cached-ttl').click();
  const freshBody = await (await freshRsc).text();
  await expect(page.getByTestId('cached-ttl-content')).toHaveText(
    'cached-ttl render #1',
  );
  expect(freshBody).not.toContain('cached-ttl-content');

  // Wait past the TTL: the entry expires, so the next navigation re-renders
  // (#2) and the element is sent again.
  await page.getByTestId('ttl-to-home').click();
  await expect(page.getByTestId('home-heading')).toBeVisible();
  await page.waitForTimeout(1500);
  const expiredRsc = page.waitForResponse('**/RSC/R/cached-ttl.txt**');
  await page.getByTestId('to-cached-ttl').click();
  const expiredBody = await (await expiredRsc).text();
  await expect(page.getByTestId('cached-ttl-content')).toHaveText(
    'cached-ttl render #2',
  );
  expect(expiredBody).toContain('cached-ttl-content');
});
