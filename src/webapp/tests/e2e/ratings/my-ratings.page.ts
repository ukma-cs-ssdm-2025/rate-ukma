import { expect, type Locator, type Page } from "@playwright/test";

import { testIds } from "@/lib/test-ids";

export class MyRatingsPage {
	private readonly page: Page;
	private readonly list: Locator;
	private readonly courseDetailsPagePattern: RegExp;

	constructor(page: Page) {
		this.page = page;
		this.list = this.page.getByTestId(testIds.myRatings.list);
		this.courseDetailsPagePattern = /\/courses\/[0-9a-fA-F-]{36}$/;
	}

	async goto(): Promise<void> {
		await this.page.goto("/my-ratings");
	}

	async openFirstCourseToRate(): Promise<void> {
		await expect(this.list).toBeVisible();
		await this.expandAllSections();

		const rateableCard = this.list
			.getByTestId(testIds.myRatings.card)
			.filter({
				has: this.page.getByTestId(testIds.myRatings.leaveReviewLink),
			})
			.first();
		await expect(rateableCard).toBeVisible();

		// Navigate via the course title link — leaveReviewLink opens an inline modal
		const courseLink = rateableCard.getByTestId(
			testIds.myRatings.courseTitleLink,
		);

		await Promise.all([
			this.page.waitForURL(this.courseDetailsPagePattern),
			courseLink.click(),
		]);
	}

	private async expandAllSections(): Promise<void> {
		const closedTriggers = this.list
			.getByTestId(testIds.myRatings.semesterTrigger)
			.and(this.page.locator('[data-state="closed"]'));
		let count = await closedTriggers.count();
		while (count > 0) {
			await closedTriggers.first().click();
			count = await closedTriggers.count();
		}
	}
}
