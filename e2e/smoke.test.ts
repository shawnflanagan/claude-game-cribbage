import { expect, test, type Page } from '@playwright/test';

// Any seed works; a fixed one keeps the Round identical run to run so a
// failure is reproducible.
const SEED = 20260905;

// A Round takes about ten seconds at the presentation pace; this is generous.
const POLL = { timeout: 60_000, intervals: [400] };

/** Every console error and uncaught exception the page produced. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    errors.push(error.message);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

test('plays a Round through the Show without console errors', async ({
  page,
}, testInfo) => {
  const errors = watchErrors(page);
  // A broken page usually stalls the Round; report the error, not the stall.
  const failed = () =>
    errors.length > 0 ? `page errors: ${errors.join(' | ')}` : null;

  await page.goto(`/?seed=${String(SEED)}`);

  // The table follows the system scheme; the felt token tells which one won.
  const dark = testInfo.project.use.colorScheme === 'dark';
  const felt = await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue('--felt')
      .trim(),
  );
  expect(felt).toBe(dark ? '#234b2c' : '#285a31');

  const status = page.getByRole('status');
  const you = page.getByRole('region', { name: 'You' });
  const hand = you.getByRole('button', { name: / of / });
  const continueButton = page.getByRole('button', { name: 'Continue' });

  // Any two cards are a legal Discard, so the first two will do.
  await expect(status).toHaveText('Choose your Discard for the Crib.');
  await expect(hand).toHaveCount(6);
  // Six cards fit one row on a phone, and nothing pushes the page sideways.
  const tops = await hand.evaluateAll((cards) =>
    cards.map((card) => card.getBoundingClientRect().top),
  );
  expect(new Set(tops).size).toBe(1);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await hand.nth(0).click();
  await hand.nth(1).click();
  await page.getByRole('button', { name: 'Send to crib' }).click();
  await expect(hand).toHaveCount(4);

  // Pegging: whenever it is our play, play any legal card, until the Show.
  await expect
    .poll(async () => {
      if (await continueButton.isVisible()) return 'show';
      const text = await status.textContent();
      if (text === 'Your play.') {
        const legal = hand.and(page.locator(':enabled'));
        if ((await legal.count()) > 0) await legal.first().click();
      }
      return failed() ?? 'pegging';
    }, POLL)
    .toBe('show');

  // The Show: Pone's Hand, Dealer's Hand, then the Crib, each behind Continue,
  // until the next Round deals.
  await expect
    .poll(async () => {
      if (await continueButton.isVisible()) {
        await continueButton.click();
        return 'show';
      }
      return failed() ?? status.textContent();
    }, POLL)
    .toBe('Choose your Discard for the Crib.');

  await expect(page.getByLabel('Scores')).toContainText('Round 2');
  expect(errors).toEqual([]);
});
