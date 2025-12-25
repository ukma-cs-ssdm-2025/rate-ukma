import { expect, type Locator, type Page } from "@playwright/test";

import { testIds } from "@/lib/test-ids";

export class MyRatingsPage {
	private readonly page: Page;
	private readonly activeLeaveReviewLinks: Locator;
	private readonly courseDetailsPagePattern: RegExp;

	constructor(page: Page) {
		this.page = page;
		this.activeLeaveReviewLinks = this.page
			.getByTestId(testIds.myRatings.list)
			.getByTestId(testIds.myRatings.leaveReviewLink);
		this.courseDetailsPagePattern = /\/courses\/[0-9a-fA-F-]{36}$/;
	}

	async goto(): Promise<void> {
		await this.page.goto("/my-ratings");
	}

	async openFirstCourseToRate(): Promise<void> {
		const enabledAction = this.activeLeaveReviewLinks.first();
		await expect(enabledAction).toBeVisible();

		await Promise.all([
			this.page.waitForURL(this.courseDetailsPagePattern),
			enabledAction.click(),
		]);
	}
}
