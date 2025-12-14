import type { Locator, Page } from "@playwright/test";

import { testIds } from "@/lib/test-ids";
import { BasePage } from "./base-page";
import { TEST_CONFIG } from "./test-config";

export class MyRatingsPage extends BasePage {
	private readonly activeLeaveReviewLinks: Locator;
	private readonly courseDetailsPagePattern: RegExp;

	constructor(page: Page) {
		super(page);
		this.activeLeaveReviewLinks = this.page
			.getByTestId(testIds.myRatings.list)
			.getByRole("link", { name: "Залишити відгук" });
		this.courseDetailsPagePattern = /\/courses\/[0-9a-fA-F-]{36}$/;
	}

	async goto(): Promise<void> {
		await this.page.goto(`${TEST_CONFIG.baseUrl}/my-ratings`);
		await this.waitForPageLoad();
	}

	async openFirstCourseToRate(): Promise<void> {
		const enabledAction = this.activeLeaveReviewLinks.first();
		await this.waitForElement(enabledAction);

		await Promise.all([
			this.page.waitForURL(this.courseDetailsPagePattern, {
				timeout: TEST_CONFIG.pageLoadTimeout,
			}),
			this.clickWithRetry(enabledAction),
		]);

		await this.waitForPageLoad();
	}
}
