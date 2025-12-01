import type { Locator, Page } from "@playwright/test";

import { BasePage } from "./base-page";

export class CoursesPage extends BasePage {
	// TODO: add filtering functionality here

	// Main
	private readonly pageTitle: Locator;
	private readonly coursesTable: Locator;

	// Navigation
	private readonly courseDetailsPagePattern: RegExp;

	constructor(page: Page) {
		super(page);

		this.pageTitle = page.locator("h1").filter({ hasText: /Курси/ });
		this.coursesTable = page.locator("table");

		this.courseDetailsPagePattern = /\/courses\/[0-9a-fA-F-]{36}$/;
	}

	async goto(): Promise<void> {
		const baseUrl = process.env.BASE_URL || "http://localhost:3000";
		await this.page.goto(baseUrl);
		await this.waitForPageLoad();
		await this.coursesTable.waitFor({ state: "visible" });
		await this.page.waitForLoadState("networkidle");
	}

	async isPageLoaded(): Promise<boolean> {
		try {
			await this.waitForElement(this.pageTitle, 5000);
			return true;
		} catch {
			return false;
		}
	}

	async getFirstCourseCard(): Promise<Locator> {
		return await this.coursesTable.locator("tbody tr").first();
	}

	async clickFirstCourseCard(): Promise<void> {
		const firstCourseCard = await this.getFirstCourseCard();
		await firstCourseCard.click();
	}

	async getFirstCourseCardTitle(): Promise<string> {
		const firstCourseCard = await this.getFirstCourseCard();
		const title = await firstCourseCard
			.locator("td span.font-semibold")
			.first()
			.textContent();
		if (!title) {
			throw new Error("Course title not found");
		}
		return title.trim();
	}

	async waitForRatingsAPIResponse(): Promise<void> {
		await this.page.waitForResponse(
			(response) =>
				response.url().includes("/ratings") && response.status() === 200,
			{ timeout: 20000 },
		);
	}

	async navigateToFirstCourseDetailsPage(): Promise<string> {
		const courseTitle = await this.getFirstCourseCardTitle();
		const firstCourseCard = await this.getFirstCourseCard();

		await firstCourseCard.waitFor({ state: "visible" });

		await Promise.all([
			this.page.waitForURL(this.courseDetailsPagePattern, { timeout: 10000 }),
			this.waitForRatingsAPIResponse(),
			firstCourseCard.click(),
		]);

		await this.page.waitForLoadState("networkidle");

		return courseTitle;
	}
}
