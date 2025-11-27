import type { Locator, Page } from "@playwright/test";

import { BasePage } from "./base-page";
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

	// Empty state
	private readonly noReviewsMessage: Locator;
	private readonly insufficientDataMessages: Locator;

	constructor(page: Page) {
		super(page);

		this.pageTitle = page.locator("h1");
		this.rateButton = page.locator("button").filter({
			hasText: /Оцінити цей курс|Редагувати оцінку/,
		});

		this.statsCardsContainer = page.locator(
			"[class*='grid gap-4 sm:grid-cols-3']",
		);
		this.reviewsCountStat = this.statsCardsContainer
			.locator("div")
			.filter({ hasText: "відгуків" })
			.first();

		this.reviewsSection = page
			.locator("h2")
			.filter({ hasText: "Відгуки студентів" });

		this.reviewCards = page.locator("article").filter({
			hasText: /Складність:|Корисність:/,
		});

		this.noReviewsMessage = page.locator("p").filter({
			hasText: "Поки що немає відгуків для цього курсу",
		});
		this.insufficientDataMessages = this.statsCardsContainer
			.locator("span")
			.filter({
				hasText: /Недостатньо даних/,
			});
	}

	async goto(courseId: string): Promise<void> {
		const baseUrl = process.env.BASE_URL || "http://localhost:3000";
		await this.page.goto(`${baseUrl}/courses/${courseId}`);
		await this.waitForPageLoad();
	}

	async isPageLoaded(): Promise<boolean> {
		try {
			await this.waitForElement(this.pageTitle, 5000);
			return true;
		} catch {
			return false;
		}
	}

	async isRateButtonVisible(): Promise<boolean> {
		try {
			await this.waitForElement(this.rateButton, 5000);
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
			await this.waitForElement(this.reviewsSection, 3000);
			return true;
		} catch {
			return false;
		}
	}

	async getReviewCardsCount(): Promise<number> {
		return await this.reviewCards.count();
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
			await this.page.waitForSelector(
				"[class*='grid gap-4 sm:grid-cols-3'] span",
				{ state: "attached", timeout: 3000 },
			);
			return await this.insufficientDataMessages.count();
		} catch {
			return 0;
		}
	}

	async findReviewCardByText(text: string): Promise<Locator> {
		return this.page.locator("article").filter({ hasText: text });
	}
}

export async function navigateToCoursePage(
	page: Page,
	courseId: string,
): Promise<void> {
	const url = `${TEST_CONFIG.baseUrl}/courses/${courseId}`;

	try {
		await page.goto(url, { waitUntil: "domcontentloaded" });
		await page.waitForLoadState("networkidle", {
			timeout: TEST_CONFIG.networkIdleTimeout,
		});
	} catch (error) {
		throw new Error(`Failed to navigate to course page ${courseId}: ${error}`);
	}
}
