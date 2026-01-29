import { expect, type Locator, type Page } from "@playwright/test";

import { testIds } from "@/lib/test-ids";

export class CourseDetailsPage {
	private readonly page: Page;
	// Main
	private readonly pageTitle: Locator;
	private readonly rateButton: Locator;

	// Stats
	private readonly statsCardsContainer: Locator;
	private readonly reviewsCountStat: Locator;

	// Reviews section
	private readonly reviewsSection: Locator;
	private readonly reviewCards: Locator;
	private readonly userRatingDeleteButton: Locator;
	private readonly deleteConfirmButton: Locator;

	// Empty state
	private readonly noReviewsMessage: Locator;
	private readonly insufficientDataMessages: Locator;
	private readonly courseDetailsUrlPattern: RegExp;

	constructor(page: Page) {
		this.page = page;

		this.pageTitle = page.getByTestId(testIds.courseDetails.title);
		this.rateButton = page.getByTestId(testIds.courseDetails.rateButton);

		this.statsCardsContainer = page.getByTestId(
			testIds.courseDetails.statsCards,
		);
		this.reviewsCountStat = page.getByTestId(
			testIds.courseDetails.ratingsCountStat,
		);

		this.reviewsSection = page.getByTestId(
			testIds.courseDetails.reviewsSection,
		);

		this.reviewCards = page.getByTestId(testIds.courseDetails.reviewCard);

		this.userRatingDeleteButton = page.getByTestId(testIds.rating.deleteButton);
		this.deleteConfirmButton = page.getByTestId(
			testIds.deleteDialog.confirmButton,
		);

		this.noReviewsMessage = page.getByTestId(
			testIds.courseDetails.noReviewsMessage,
		);
		this.insufficientDataMessages = this.statsCardsContainer
			.locator("span")
			.filter({
				hasText: /Недостатньо даних/,
			});

		this.courseDetailsUrlPattern = /\/courses\/[0-9a-fA-F-]{36}$/;
	}

	async goto(courseId: string): Promise<void> {
		await this.page.goto(`/courses/${courseId}`);
	}

	async isPageLoaded(): Promise<boolean> {
		let loaded = false;
		await expect
			.poll(async () => {
				const urlOk = this.courseDetailsUrlPattern.test(this.page.url());
				const titleVisible = await this.pageTitle.isVisible();
				loaded = urlOk && titleVisible;
				return loaded;
			})
			.toBe(true);
		return loaded;
	}

	async isRateButtonVisible(): Promise<boolean> {
		return await this.rateButton.isVisible();
	}

	async clickRateButton(): Promise<void> {
		await expect(this.rateButton).toBeVisible();
		await this.rateButton.click();
	}

	async hasStatsData(): Promise<boolean> {
		await expect(this.statsCardsContainer).toBeVisible();

		const spans = this.statsCardsContainer.locator("span");
		const texts = await spans.allTextContents();
		const values = texts
			.map((t) => Number(t.trim()))
			.filter((n) => !Number.isNaN(n));

		// 1 ≤ n ≤ 5
		const ratings = values.filter((n) => n >= 1 && n <= 5);

		return ratings.length >= 2;
	}

	async getReviewsCount(): Promise<number> {
		const countElement = this.reviewsCountStat.locator("span").filter({
			hasText: /\d+/,
		});
		const countText = (await countElement.textContent())?.trim() ?? "";
		const match = countText.match(/\d+/);
		return match ? Number(match[0]) : 0;
	}

	async isReviewsSectionVisible(): Promise<boolean> {
		return await this.reviewsSection.isVisible();
	}

	async getReviewCardsCount(): Promise<number> {
		return await this.reviewCards.count();
	}

	async expectNoReviewsMessageVisible(): Promise<void> {
		await expect(this.noReviewsMessage).toBeVisible();
	}

	async getInsufficientDataMessagesCount(): Promise<number> {
		if (!(await this.statsCardsContainer.isVisible())) {
			return 0;
		}
		return await this.insufficientDataMessages.count();
	}

	async findReviewCardByText(text: string): Promise<Locator> {
		const reviewCard = this.reviewCards.filter({ hasText: text });
		await expect(reviewCard).toBeVisible();
		return reviewCard;
	}

	async deleteUserRating(): Promise<void> {
		await expect(this.userRatingDeleteButton).toBeVisible();
		await this.userRatingDeleteButton.click();
		await expect(this.deleteConfirmButton).toBeVisible();
		await this.deleteConfirmButton.click();
	}

	async waitForReviewsData(minReviews = 1): Promise<void> {
		await expect(this.reviewsSection).toBeVisible();
		await expect(this.reviewsCountStat).toBeVisible();

		await expect
			.poll(async () => await this.getReviewCardsCount())
			.toBeGreaterThanOrEqual(minReviews);
		await expect
			.poll(async () => await this.getReviewsCount())
			.toBeGreaterThanOrEqual(minReviews);
	}
}
