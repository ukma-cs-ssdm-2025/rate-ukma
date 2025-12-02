import type { Locator, Page } from "@playwright/test";

import { BasePage } from "./base-page";

export class MyRatingsPage extends BasePage {
	private readonly activeLeaveReviewButtons: Locator;

	constructor(page: Page) {
		super(page);
		this.activeLeaveReviewButtons = this.page.locator(`
		a[data-slot="button"]:has(span:has-text("Залишити відгук"))
	`);
	}

	async goto(): Promise<void> {
		const baseUrl = process.env.BASE_URL || "http://localhost:3000";
		await this.page.goto(`${baseUrl}/my-ratings`);
		await this.waitForPageLoad();
	}

	async openFirstCourseToRate(): Promise<void> {
		const enabledAction = this.activeLeaveReviewButtons.first();

		await this.waitForElement(enabledAction);

		await Promise.all([
			this.clickWithRetry(enabledAction),
			this.page.waitForLoadState("networkidle"),
		]);
	}
}
