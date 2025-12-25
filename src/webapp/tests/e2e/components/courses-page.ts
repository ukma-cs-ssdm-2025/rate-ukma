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

	// Sorting
	private readonly difficultySortButton: Locator;
	private readonly usefulnessSortButton: Locator;

	// Filters
	private readonly filtersDrawer: Locator;
	private readonly filtersDrawerTrigger: Locator;
	private readonly filtersDrawerCloseButton: Locator;
	private readonly filtersResetButton: Locator;

	// Pagination
	private readonly paginationLabel: Locator;
	private readonly paginationNextButton: Locator;
	private readonly paginationPreviousButton: Locator;
	private readonly paginationLastButton: Locator;

	// Navigation
	private readonly courseDetailsPagePattern: RegExp;

	constructor(page: Page) {
		super(page);

		this.coursesTable = page.getByTestId(testIds.courses.table);
		this.courseTitleLinks = this.coursesTable.getByTestId(
			testIds.courses.tableTitleLink,
		);
		this.searchInput = page.getByTestId(testIds.courses.searchInput);
		this.difficultySortButton = page.getByTestId(
			testIds.courses.difficultySortButtonDesktop,
		);
		this.usefulnessSortButton = page.getByTestId(
			testIds.courses.usefulnessSortButtonDesktop,
		);

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
		this.paginationLastButton = page.getByTestId(testIds.common.paginationLast);

		this.courseDetailsPagePattern = /\/courses\/[0-9a-fA-F-]{36}$/;
	}

	async goto(): Promise<void> {
		await this.page.goto(TEST_CONFIG.baseUrl);
		await this.waitForPageLoad();

		const outcome = await expect
			.poll(
				async () => {
					if (this.page.url().includes("/connection-error")) {
						return "connection-error";
					}

					const hasErrorState = await this.page
						.getByTestId(testIds.courses.errorState)
						.isVisible()
						.catch(() => false);
					if (hasErrorState) {
						return "error";
					}

					const hasTable = await this.coursesTable
						.isVisible()
						.catch(() => false);
					if (hasTable) {
						return "table";
					}

					return "";
				},
				{ timeout: TEST_CONFIG.timeoutMs },
			)
			.not.toBe("");

		if (outcome === "table") {
			await this.waitForCoursesToRender();
		}
	}

	async gotoWithSearchParams(params: Record<string, string>): Promise<void> {
		const url = new URL(TEST_CONFIG.baseUrl);
		url.search = new URLSearchParams(params).toString();
		await this.page.goto(url.toString());
		await this.waitForPageLoad();
		await this.waitForTableReady();
	}

	async clearSearch(): Promise<void> {
		await this.waitForElement(this.searchInput, TEST_CONFIG.timeoutMs);
		await this.fillWithRetry(this.searchInput, "");

		await expect
			.poll(async () => new URL(this.page.url()).searchParams.get("q") ?? "", {
				timeout: TEST_CONFIG.timeoutMs,
			})
			.toBe("");

		await this.waitForCoursesToRender();
	}

	async sortByDifficulty(): Promise<void> {
		await this.clickWithRetry(this.difficultySortButton);
		await this.waitForCoursesToRender();
	}

	async sortByUsefulness(): Promise<void> {
		await this.clickWithRetry(this.usefulnessSortButton);
		await this.waitForCoursesToRender();
	}

	async getCurrentPageNumber(): Promise<number> {
		const { currentPage } = await this.getPaginationInfo();
		return currentPage;
	}

	async getTotalPagesNumber(): Promise<number> {
		const { totalPages } = await this.getPaginationInfo();
		return totalPages;
	}

	private async getPaginationInfo(): Promise<{
		currentPage: number;
		totalPages: number;
	}> {
		const label = await this.getPaginationLabelText();
		const match = label.match(/^Сторінка\s+(\d+)\s+з\s+(\d+)$/);
		if (!match) {
			throw new Error(`Unexpected pagination label: ${label}`);
		}
		const currentPage = Number(match[1]);
		const totalPages = Number(match[2]);
		if (!Number.isFinite(currentPage) || !Number.isFinite(totalPages)) {
			throw new Error(`Invalid pagination label: ${label}`);
		}
		return { currentPage, totalPages };
	}

	async isPageLoaded(): Promise<boolean> {
		try {
			await this.waitForElement(this.coursesTable, TEST_CONFIG.timeoutMs);
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
			await this.waitForElement(firstCourseCard, TEST_CONFIG.timeoutMs);

			await Promise.all([
				this.page.waitForURL(this.courseDetailsPagePattern, {
					timeout: TEST_CONFIG.timeoutMs,
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
		await this.waitForElement(this.paginationLabel, TEST_CONFIG.timeoutMs);
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
		await this.waitForElement(this.searchInput, TEST_CONFIG.timeoutMs);
		await this.fillWithRetry(this.searchInput, query);

		await expect
			.poll(async () => new URL(this.page.url()).searchParams.get("q") ?? "", {
				timeout: TEST_CONFIG.timeoutMs,
			})
			.toBe(query);

		await this.waitForCoursesToRender();
	}

	async resetFilters(): Promise<void> {
		await this.ensureFiltersResetButtonVisible();
		await this.clickWithRetry(this.filtersResetButton);

		await expect
			.poll(async () => new URL(this.page.url()).searchParams.get("q") ?? "", {
				timeout: TEST_CONFIG.timeoutMs,
			})
			.toBe("");

		await this.waitForCoursesToRender();
	}

	async openFiltersDrawer(): Promise<void> {
		await this.clickWithRetry(this.filtersDrawerTrigger);
		await this.waitForElement(this.filtersDrawer, TEST_CONFIG.timeoutMs);
	}

	async closeFiltersDrawer(): Promise<void> {
		await this.waitForElement(
			this.filtersDrawerCloseButton,
			TEST_CONFIG.timeoutMs,
		);
		await this.clickWithRetry(this.filtersDrawerCloseButton);
		await this.filtersDrawer.waitFor({ state: "hidden" });
	}

	async openCourseByIndex(index: number): Promise<void> {
		await this.waitForCoursesToRender();

		await withRetry(async () => {
			const row = this.coursesTable
				.getByTestId(testIds.courses.tableRow)
				.nth(index);
			const courseLink = row.getByTestId(testIds.courses.tableTitleLink);

			await expect(courseLink).toBeVisible({
				timeout: TEST_CONFIG.timeoutMs,
			});

			await Promise.all([
				this.page.waitForURL(this.courseDetailsPagePattern, {
					timeout: TEST_CONFIG.timeoutMs,
				}),
				this.clickWithRetry(courseLink),
			]);
		}, TEST_CONFIG.maxRetries + 2);

		await this.waitForPageLoad();
	}

	async openLastCourseOnPage(): Promise<void> {
		await this.waitForCoursesToRender();

		await withRetry(async () => {
			const row = this.coursesTable
				.getByTestId(testIds.courses.tableRow)
				.last();
			const courseLink = row.getByTestId(testIds.courses.tableTitleLink);

			await expect(courseLink).toBeVisible({
				timeout: TEST_CONFIG.timeoutMs,
			});

			await Promise.all([
				this.page.waitForURL(this.courseDetailsPagePattern, {
					timeout: TEST_CONFIG.timeoutMs,
				}),
				this.clickWithRetry(courseLink),
			]);
		}, TEST_CONFIG.maxRetries + 2);

		await this.waitForPageLoad();
	}

	async goToLastPage(): Promise<void> {
		await this.waitForElement(this.paginationLabel, TEST_CONFIG.timeoutMs);

		if (!(await this.paginationLastButton.isVisible())) {
			throw new Error(
				"Pagination last button is not visible. Run this flow on a desktop viewport.",
			);
		}

		const before = await this.getPaginationLabelText();
		const match = before.match(/\s(\d+)\s+з\s+(\d+)$/);
		if (!match) {
			throw new Error(`Unexpected pagination label: ${before}`);
		}
		const totalPages = Number(match[2]);
		if (!Number.isFinite(totalPages) || totalPages < 1) {
			throw new Error(`Invalid total pages: ${String(match[2])}`);
		}

		const waitForLastPageResponse = this.page.waitForResponse(
			(response) => {
				if (response.request().method() !== "GET") return false;
				if (!response.url().includes("/api/v1/courses/")) return false;
				try {
					const url = new URL(response.url());
					return url.searchParams.get("page") === String(totalPages);
				} catch {
					return false;
				}
			},
			{ timeout: TEST_CONFIG.timeoutMs },
		);

		await this.clickWithRetry(this.paginationLastButton);

		await expect(this.paginationNextButton).toBeDisabled({
			timeout: TEST_CONFIG.timeoutMs,
		});
		await expect(this.paginationLabel).not.toHaveText(before, {
			timeout: TEST_CONFIG.timeoutMs,
		});

		await expect
			.poll(
				async () => new URL(this.page.url()).searchParams.get("page") ?? "",
				{ timeout: TEST_CONFIG.timeoutMs },
			)
			.toBe(String(totalPages));

		await waitForLastPageResponse;
		await this.waitForCoursesToRender();
	}

	async getPaginationLabelText(): Promise<string> {
		await this.waitForElement(this.paginationLabel, TEST_CONFIG.timeoutMs);
		return (await this.paginationLabel.textContent())?.trim() ?? "";
	}

	async goToNextPage(): Promise<void> {
		await this.waitForElement(this.paginationNextButton, TEST_CONFIG.timeoutMs);
		const before = await this.getPaginationLabelText();
		await this.clickWithRetry(this.paginationNextButton);
		await expect(this.paginationLabel).not.toHaveText(before, {
			timeout: TEST_CONFIG.timeoutMs,
		});
		await this.waitForCoursesToRender();
	}

	async goToPreviousPage(): Promise<void> {
		await this.waitForElement(
			this.paginationPreviousButton,
			TEST_CONFIG.timeoutMs,
		);
		const before = await this.getPaginationLabelText();
		await this.clickWithRetry(this.paginationPreviousButton);
		await expect(this.paginationLabel).not.toHaveText(before, {
			timeout: TEST_CONFIG.timeoutMs,
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
				timeout: TEST_CONFIG.timeoutMs,
			});
			return;
		}

		throw new Error("Filters reset button is not visible");
	}

	private async waitForCoursesToRender(): Promise<void> {
		await this.waitForElement(this.coursesTable, TEST_CONFIG.timeoutMs);

		await withRetry(async () => {
			const isEmpty = await this.page
				.getByTestId(testIds.courses.emptyState)
				.isVisible()
				.catch(() => false);
			if (isEmpty) {
				return;
			}

			const rowCount = await this.coursesTable
				.getByTestId(testIds.courses.tableRow)
				.count();
			if (rowCount === 0) {
				throw new Error("Courses table has not finished rendering");
			}
		}, TEST_CONFIG.maxRetries + 2);
	}
}
