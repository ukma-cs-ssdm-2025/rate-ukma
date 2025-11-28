import type { Locator, Page } from "@playwright/test";

import { BasePage } from "./base-page";

export class MyRatingsPage extends BasePage {
	private readonly leaveReviewButtons: Locator;

	constructor(page: Page) {
		super(page);
		this.leaveReviewButtons = page.locator("span", {
			hasText: "Залишити відгук",
		});
	}

	async goto(): Promise<void> {
		const baseUrl = process.env.BASE_URL || "http://localhost:3000";
		await this.page.goto(`${baseUrl}/my-ratings`);
		await this.waitForPageLoad();
	}

	async openFirstCourseToRate(): Promise<void> {
		const button = this.leaveReviewButtons.first();
		await this.waitForElement(button);

		const courseTitle = button.locator(
			"xpath=(ancestor::*[.//h3])[1]/descendant::h3[1]",
		);

		await Promise.all([
			this.clickWithRetry(courseTitle),
			this.page.waitForLoadState("networkidle"),
		]);
	}
}
