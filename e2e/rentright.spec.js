'use strict';
const { test, expect } = require('@playwright/test');

test('listing discovery, matching, visit requests and owner workflow', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => { pageErrors.push(error.message); console.log('PAGE_ERROR', error.message); });
  await page.goto('/');
  await expect(page.locator('.property')).toHaveCount(12);

  await page.locator('#search').fill('Gachibowli');
  await expect(page.locator('.property')).toHaveCount(1);
  await page.locator('#reset').click();
  await page.locator('#findMatches').click();
  await expect(page.locator('#smartMatchResult')).toContainText('% match');

  await page.locator('#visitorName').fill('Browser Test');
  await page.locator('#visitorEmail').fill(`browser-${Date.now()}@example.test`);
  const day = String(1 + (Date.now() % 28)).padStart(2, '0');
  const month = String(1 + (Math.floor(Date.now() / 1000) % 12)).padStart(2, '0');
  await page.locator('#visitDate').fill(`2099-${month}-${day}`);
  await page.locator('#visitTime').selectOption({ label: '11:00 AM' });
  await page.locator('#visitForm input[type="checkbox"]').check();
  await page.locator('#visitForm button[type="submit"]').click();
  await expect(page.locator('#visitStatus')).toContainText('submitted successfully');

  await page.locator('#authRole').selectOption('owner');
  await page.locator('#authName').fill('Browser Owner');
  await page.locator('#authEmail').fill(`owner-${Date.now()}@example.test`);
  await page.locator('#authPassword').fill('BrowserTest1234');
  await page.locator('#authForm button[type="submit"]').click();
  await expect(page.locator('#authStatus')).toContainText('Account created');
  await page.locator('#authAction').selectOption('login');
  await page.locator('#authPassword').fill('BrowserTest1234');
  await page.locator('#authForm button[type="submit"]').click();
  await expect(page.locator('#accountGreeting')).toContainText('Browser Owner');
  await expect.poll(async () => (await page.context().cookies()).some(cookie => cookie.name === 'nn_session')).toBe(true);
  const sessionCheck = await page.request.get('/api/auth/me');
  expect(sessionCheck.status()).toBe(200);

  await page.locator('#claimPropertyId').fill('1');
  await page.locator('#claimProperty').click();
  await expect(page.locator('#toast')).toContainText('linked to your owner account');
  await page.locator('.heart').first().click();
  await expect(page.locator('#savedCount')).toHaveText('1');
  await page.locator('#loadOwnerVisits').click();
  await expect(page.locator('#ownerVisits')).toContainText('Browser Test');
  expect(pageErrors).toEqual([]);
});
