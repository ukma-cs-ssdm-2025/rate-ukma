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

	async navigateToFirstCourseDetailsPage(): Promise<string> {
		const courseTitle = await this.getFirstCourseCardTitle();
		const firstCourseCard = await this.getFirstCourseCard();

		await Promise.all([
			firstCourseCard.click(),
			this.page.waitForURL(this.courseDetailsPagePattern),
		]);

		return courseTitle;
	}
}
