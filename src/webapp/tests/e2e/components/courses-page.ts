import type { Locator, Page } from "@playwright/test";

import { testIds } from "@/lib/test-ids";
import { BasePage } from "./base-page";
import { withRetry } from "./common";
import { TEST_CONFIG } from "./test-config";

export class CoursesPage extends BasePage {
	// TODO: add filtering functionality here

	// Main
	private readonly pageTitle: Locator;
	private readonly coursesTable: Locator;
	private readonly courseTitleLinks: Locator;

	// Navigation
	private readonly courseDetailsPagePattern: RegExp;

	constructor(page: Page) {
		super(page);

		this.pageTitle = page.locator("h3").filter({ hasText: "Карта курсів" });
		this.coursesTable = page.getByTestId(testIds.courses.table);
		this.courseTitleLinks = page.getByTestId(testIds.courses.tableTitleLink);

		this.courseDetailsPagePattern = /\/courses\/[0-9a-fA-F-]{36}$/;
	}

	async goto(): Promise<void> {
		const baseUrl = process.env.BASE_URL || "http://localhost:3000";
		await this.page.goto(baseUrl);
		await this.waitForPageLoad();
		await this.coursesTable.waitFor({ state: "visible" });
		await this.waitForCoursesToRender();
	}

	async isPageLoaded(): Promise<boolean> {
		try {
			await this.waitForElement(this.pageTitle, TEST_CONFIG.pageLoadTimeout);
			return true;
		} catch {
			return false;
		}
	}

	async getFirstCourseCard(): Promise<Locator> {
		await this.waitForCoursesToRender();
		return this.courseTitleLinks.first();
	}

	async clickFirstCourseCard(): Promise<void> {
		const firstCourseCard = await this.getFirstCourseCard();
		await withRetry(async () => {
			await this.waitForElement(firstCourseCard, TEST_CONFIG.elementTimeout);

			await Promise.all([
				this.page.waitForURL(this.courseDetailsPagePattern, {
					timeout: TEST_CONFIG.pageLoadTimeout,
				}),
				this.clickWithRetry(firstCourseCard),
			]);
		}, TEST_CONFIG.maxRetries + 2);

		await this.waitForPageLoad();
	}

	async getFirstCourseCardTitle(): Promise<string> {
		const firstCourseCard = await this.getFirstCourseCard();
		await this.waitForElement(firstCourseCard);
		const title = await firstCourseCard.textContent();
		if (!title) {
			throw new Error("Course title not found");
		}
		return title.trim();
	}

	async navigateToFirstCourseDetailsPage(): Promise<string> {
		const courseTitle = await this.getFirstCourseCardTitle();
		await this.clickFirstCourseCard();

		return courseTitle;
	}

	private async waitForCoursesToRender(): Promise<void> {
		await this.waitForElement(this.coursesTable, TEST_CONFIG.pageLoadTimeout);
		await withRetry(async () => {
			const courseCount = await this.courseTitleLinks.count();
			if (courseCount === 0) {
				throw new Error("Courses have not finished loading");
			}
		}, TEST_CONFIG.maxRetries + 2);
	}
}
