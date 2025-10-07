import { test, expect } from '@playwright/test';

test.describe('Global availability regression', () => {
  test('TemplateDoctorApiClient & TemplateDoctorIssueService become available', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => !!(window.TemplateDoctorApiClient && window.TemplateDoctorIssueService),
      { timeout: 5000 },
    );
    const result = await page.evaluate(() => ({
      api: !!window.TemplateDoctorApiClient,
      issueService: !!window.TemplateDoctorIssueService,
    }));
    expect(result.api).toBeTruthy();
    expect(result.issueService).toBeTruthy();
  });
});
