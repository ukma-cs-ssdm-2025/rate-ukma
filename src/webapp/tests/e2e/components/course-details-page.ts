import type { Locator, Page } from "@playwright/test";

import { testIds } from "@/lib/test-ids";
import { BasePage } from "./base-page";
import { withRetry } from "./common";
import { TEST_CONFIG } from "./test-config";

export class CourseDetailsPage extends BasePage {
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
		super(page);

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
		await this.page.goto(`${TEST_CONFIG.baseUrl}/courses/${courseId}`);
		await this.waitForPageLoad();
	}

	async waitForTitle(timeout: number = TEST_CONFIG.timeoutMs): Promise<void> {
		await this.waitForElement(this.pageTitle, timeout);
	}

	async waitForStats(timeout: number = TEST_CONFIG.timeoutMs): Promise<void> {
		await this.waitForElement(this.statsCardsContainer, timeout);
		await this.waitForElement(this.reviewsCountStat, timeout);
	}

	async isPageLoaded(): Promise<boolean> {
		try {
			await withRetry(
				async () => {
					await this.page.waitForURL(this.courseDetailsUrlPattern, {
						timeout: TEST_CONFIG.timeoutMs,
					});
					await this.waitForPageLoad(TEST_CONFIG.timeoutMs);
					await this.waitForElement(this.pageTitle, TEST_CONFIG.timeoutMs);
				},
				TEST_CONFIG.maxRetries,
				TEST_CONFIG.retryDelay,
			);
			return true;
		} catch {
			return false;
		}
	}

	async isRateButtonVisible(): Promise<boolean> {
		try {
			await this.waitForElement(this.rateButton, TEST_CONFIG.timeoutMs);
			return true;
		} catch {
			return false;
		}
	}

	async clickRateButton(): Promise<void> {
		await this.waitForElement(this.rateButton);
		await this.clickWithRetry(this.rateButton);
	}

	async hasStatsData(): Promise<boolean> {
		await this.waitForElement(this.statsCardsContainer);
		try {
			const spans = this.statsCardsContainer.locator("span");

			const values = await spans.evaluateAll((nodes) => {
				return nodes
					.map((n) => n.textContent?.trim() ?? "")
					.map((t) => Number(t))
					.filter((n) => !Number.isNaN(n));
			});

			// 1 ≤ n ≤ 5
			const ratings = values.filter((n) => n >= 1 && n <= 5);

			return ratings.length >= 2;
		} catch {
			return false;
		}
	}

	async getReviewsCount(): Promise<number> {
		const countElement = this.reviewsCountStat.locator("span").filter({
			hasText: /\d+/,
		});
		const countText = await this.getTextContent(countElement);
		const match = countText.match(/\d+/);
		return match ? Number(match[0]) : 0;
	}

	async isReviewsSectionVisible(): Promise<boolean> {
		try {
			await this.waitForElement(this.reviewsSection);
			return true;
		} catch {
			return false;
		}
	}

	async getReviewCardsCount(): Promise<number> {
		return await this.reviewCards.count();
	}

	async waitForRatingElements(): Promise<void> {
		await this.waitForElement(this.reviewsSection, TEST_CONFIG.timeoutMs);
		await this.waitForElement(this.reviewsCountStat, TEST_CONFIG.timeoutMs);
		await this.waitForElement(this.reviewCards.first(), TEST_CONFIG.timeoutMs);
	}

	async isNoReviewsMessageVisible(): Promise<boolean> {
		try {
			await this.waitForElement(this.noReviewsMessage, 3000);
			return true;
		} catch {
			return false;
		}
	}

	async getInsufficientDataMessagesCount(): Promise<number> {
		try {
			await this.waitForElement(this.statsCardsContainer);
			return await this.insufficientDataMessages.count();
		} catch {
			return 0;
		}
	}

	async findReviewCardByText(text: string): Promise<Locator> {
		const reviewCard = this.reviewCards.filter({ hasText: text });
		await this.waitForElement(reviewCard);
		return reviewCard;
	}

	async deleteUserRating(): Promise<void> {
		await this.waitForElement(this.userRatingDeleteButton);
		await this.clickWithRetry(this.userRatingDeleteButton);
		await this.waitForElement(this.deleteConfirmButton);
		await this.clickWithRetry(this.deleteConfirmButton);
	}

	async waitForReviewsData(minReviews = 1): Promise<void> {
		await this.waitForRatingElements();

		await withRetry(async () => {
			const reviewCardsCount = await this.getReviewCardsCount();
			const reviewStatsCount = await this.getReviewsCount();

			if (reviewCardsCount < minReviews || reviewStatsCount < minReviews) {
				throw new Error(
					`Waiting for reviews to load (cards: ${reviewCardsCount}, stats: ${reviewStatsCount})`,
				);
			}
		}, TEST_CONFIG.maxRetries + 2);
	}
}
