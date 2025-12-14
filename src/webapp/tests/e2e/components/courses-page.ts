import { expect, type Locator, type Page } from "@playwright/test";

import { testIds } from "@/lib/test-ids";
import { BasePage } from "./base-page";
import { withRetry } from "./common";
import { TEST_CONFIG } from "./test-config";

export class CoursesPage extends BasePage {
	// Main
	private readonly coursesTable: Locator;
	private readonly courseTitleLinks: Locator;
	private readonly searchInput: Locator;

	// Filters
	private readonly filtersDrawer: Locator;
	private readonly filtersDrawerTrigger: Locator;
	private readonly filtersDrawerCloseButton: Locator;
	private readonly filtersResetButton: Locator;

	// Pagination
	private readonly paginationLabel: Locator;
	private readonly paginationNextButton: Locator;
	private readonly paginationPreviousButton: Locator;

	// Navigation
	private readonly courseDetailsPagePattern: RegExp;

	constructor(page: Page) {
		super(page);

		this.coursesTable = page.getByTestId(testIds.courses.table);
		this.courseTitleLinks = this.coursesTable.getByTestId(
			testIds.courses.tableTitleLink,
		);
		this.searchInput = page.getByTestId(testIds.courses.searchInput);

		this.filtersDrawer = page.getByTestId(testIds.filters.drawer);
		this.filtersDrawerTrigger = page.getByTestId(testIds.filters.drawerTrigger);
		this.filtersDrawerCloseButton = page.getByTestId(
			testIds.filters.drawerCloseButton,
		);
		this.filtersResetButton = page.getByTestId(testIds.filters.resetButton);

		this.paginationLabel = page.getByTestId(testIds.common.paginationLabel);
		this.paginationNextButton = page.getByTestId(testIds.common.paginationNext);
		this.paginationPreviousButton = page.getByTestId(
			testIds.common.paginationPrevious,
		);

		this.courseDetailsPagePattern = /\/courses\/[0-9a-fA-F-]{36}$/;
	}

	async goto(): Promise<void> {
		await this.page.goto(TEST_CONFIG.baseUrl);
		await this.waitForPageLoad();
		await this.coursesTable.waitFor({ state: "visible" });
		await this.waitForCoursesToRender();
	}

	async isPageLoaded(): Promise<boolean> {
		try {
			await this.waitForElement(this.coursesTable, TEST_CONFIG.pageLoadTimeout);
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

	async waitForTableReady(): Promise<void> {
		await this.waitForCoursesToRender();
		await this.waitForElement(
			this.paginationLabel,
			TEST_CONFIG.pageLoadTimeout,
		);
	}

	async getCourseCount(): Promise<number> {
		await this.waitForCoursesToRender();
		return await this.courseTitleLinks.count();
	}

	async getCourseTitles(): Promise<string[]> {
		await this.waitForCoursesToRender();
		const titles = await this.courseTitleLinks.allTextContents();
		return titles.map((t) => t.trim()).filter(Boolean);
	}

	async searchByTitle(query: string): Promise<void> {
		await this.waitForElement(this.searchInput, TEST_CONFIG.pageLoadTimeout);
		await this.fillWithRetry(this.searchInput, query);

		await expect
			.poll(async () => new URL(this.page.url()).searchParams.get("q") ?? "", {
				timeout: TEST_CONFIG.pageLoadTimeout,
			})
			.toBe(query);

		await this.waitForCoursesToRender();
	}

	async resetFilters(): Promise<void> {
		await this.ensureFiltersResetButtonVisible();
		await this.clickWithRetry(this.filtersResetButton);

		await expect
			.poll(async () => new URL(this.page.url()).searchParams.get("q") ?? "", {
				timeout: TEST_CONFIG.pageLoadTimeout,
			})
			.toBe("");

		await this.waitForCoursesToRender();
	}

	async openFiltersDrawer(): Promise<void> {
		await this.clickWithRetry(this.filtersDrawerTrigger);
		await this.waitForElement(this.filtersDrawer, TEST_CONFIG.pageLoadTimeout);
	}

	async closeFiltersDrawer(): Promise<void> {
		await this.waitForElement(
			this.filtersDrawerCloseButton,
			TEST_CONFIG.pageLoadTimeout,
		);
		await this.clickWithRetry(this.filtersDrawerCloseButton);
		await this.filtersDrawer.waitFor({ state: "hidden" });
	}

	async getPaginationLabelText(): Promise<string> {
		await this.waitForElement(
			this.paginationLabel,
			TEST_CONFIG.pageLoadTimeout,
		);
		return (await this.paginationLabel.textContent())?.trim() ?? "";
	}

	async goToNextPage(): Promise<void> {
		await this.waitForElement(
			this.paginationNextButton,
			TEST_CONFIG.pageLoadTimeout,
		);
		const before = await this.getPaginationLabelText();
		await this.clickWithRetry(this.paginationNextButton);
		await expect(this.paginationLabel).not.toHaveText(before, {
			timeout: TEST_CONFIG.pageLoadTimeout,
		});
		await this.waitForCoursesToRender();
	}

	async goToPreviousPage(): Promise<void> {
		await this.waitForElement(
			this.paginationPreviousButton,
			TEST_CONFIG.pageLoadTimeout,
		);
		const before = await this.getPaginationLabelText();
		await this.clickWithRetry(this.paginationPreviousButton);
		await expect(this.paginationLabel).not.toHaveText(before, {
			timeout: TEST_CONFIG.pageLoadTimeout,
		});
		await this.waitForCoursesToRender();
	}

	private async ensureFiltersResetButtonVisible(): Promise<void> {
		try {
			await this.filtersResetButton.waitFor({
				state: "visible",
				timeout: 2000,
			});
			return;
		} catch {
			// ignore
		}

		// If the desktop panel isn't available, reset button lives in the drawer.
		if (await this.filtersDrawerTrigger.isVisible()) {
			await this.openFiltersDrawer();
			await this.filtersResetButton.waitFor({
				state: "visible",
				timeout: TEST_CONFIG.pageLoadTimeout,
			});
			return;
		}

		throw new Error("Filters reset button is not visible");
	}

	private async waitForCoursesToRender(): Promise<void> {
		await this.waitForElement(this.coursesTable, TEST_CONFIG.pageLoadTimeout);
		await withRetry(async () => {
			const rowCount = await this.coursesTable.locator("tbody tr").count();
			if (rowCount === 0) {
				throw new Error("Courses table has not finished rendering");
			}
		}, TEST_CONFIG.maxRetries + 2);
	}
}
