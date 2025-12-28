import { expect, type Locator, type Page } from "@playwright/test";

import { testIds } from "@/lib/test-ids";
import { getSearchParam } from "../shared/url-assertions";

export class CoursesPage {
	private readonly page: Page;

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
		this.page = page;

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
		await this.page.goto("/");

		let outcome = "";
		await expect
			.poll(async () => {
				if (this.page.url().includes("/connection-error")) {
					outcome = "connection-error";
					return outcome;
				}

				const hasErrorState = await this.page
					.getByTestId(testIds.courses.errorState)
					.isVisible();
				if (hasErrorState) {
					outcome = "error";
					return outcome;
				}

				const hasTable = await this.coursesTable.isVisible();
				if (hasTable) {
					outcome = "table";
					return outcome;
				}

				outcome = "";
				return outcome;
			})
			.not.toBe("");

		if (outcome === "table") {
			await this.waitForCoursesToRender();
		}
	}

	async gotoWithSearchParams(params: Record<string, string>): Promise<void> {
		const search = new URLSearchParams(params).toString();
		await this.page.goto(search ? `/?${search}` : "/");
		await this.waitForTableReady();
	}

	async clearSearch(): Promise<void> {
		await expect(this.searchInput).toBeVisible();
		await this.searchInput.fill("");

		await expect.poll(() => getSearchParam(this.page, "q")).toBe("");

		await this.waitForCoursesToRender();
	}

	async sortByDifficulty(): Promise<void> {
		await this.difficultySortButton.click();
		await this.waitForCoursesToRender();
	}

	async sortByUsefulness(): Promise<void> {
		await this.usefulnessSortButton.click();
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
		return await this.coursesTable.isVisible();
	}

	async getFirstCourseCard(): Promise<Locator> {
		await this.waitForCoursesToRender();
		return this.courseTitleLinks.first();
	}

	async clickFirstCourseCard(): Promise<void> {
		const firstCourseCard = await this.getFirstCourseCard();
		await expect(firstCourseCard).toBeVisible();

		await Promise.all([
			this.page.waitForURL(this.courseDetailsPagePattern),
			firstCourseCard.click(),
		]);
	}

	async getFirstCourseCardTitle(): Promise<string> {
		const firstCourseCard = await this.getFirstCourseCard();
		await expect(firstCourseCard).toBeVisible();
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
		await expect(this.paginationLabel).toBeVisible();
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
		await expect(this.searchInput).toBeVisible();
		await this.searchInput.fill(query);

		await expect.poll(() => getSearchParam(this.page, "q")).toBe(query);

		await this.waitForCoursesToRender();
	}

	async resetFilters(): Promise<void> {
		await this.ensureFiltersResetButtonVisible();
		await this.filtersResetButton.click();

		await expect.poll(() => getSearchParam(this.page, "q")).toBe("");

		await this.waitForCoursesToRender();
	}

	async openFiltersDrawer(): Promise<void> {
		await this.filtersDrawerTrigger.click();
		await expect(this.filtersDrawer).toBeVisible();
	}

	async closeFiltersDrawer(): Promise<void> {
		await expect(this.filtersDrawerCloseButton).toBeVisible();
		await this.filtersDrawerCloseButton.click();
		await expect(this.filtersDrawer).toBeHidden();
	}

	async openCourseByIndex(index: number): Promise<void> {
		await this.waitForCoursesToRender();

		const row = this.coursesTable
			.getByTestId(testIds.courses.tableRow)
			.nth(index);
		const courseLink = row.getByTestId(testIds.courses.tableTitleLink);
		await expect(courseLink).toBeVisible();

		await Promise.all([
			this.page.waitForURL(this.courseDetailsPagePattern),
			courseLink.click(),
		]);
	}

	async openLastCourseOnPage(): Promise<void> {
		await this.waitForCoursesToRender();

		const row = this.coursesTable.getByTestId(testIds.courses.tableRow).last();
		const courseLink = row.getByTestId(testIds.courses.tableTitleLink);
		await expect(courseLink).toBeVisible();

		await Promise.all([
			this.page.waitForURL(this.courseDetailsPagePattern),
			courseLink.click(),
		]);
	}

	async goToLastPage(): Promise<void> {
		await expect(this.paginationLabel).toBeVisible();

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

		const waitForLastPageResponse = this.page.waitForResponse((response) => {
			if (response.request().method() !== "GET") return false;
			if (!response.url().includes("/api/v1/courses/")) return false;
			try {
				const url = new URL(response.url());
				return url.searchParams.get("page") === String(totalPages);
			} catch {
				return false;
			}
		});

		await this.paginationLastButton.click();

		await expect(this.paginationNextButton).toBeDisabled();
		await expect(this.paginationLabel).not.toHaveText(before);

		await expect
			.poll(() => getSearchParam(this.page, "page"))
			.toBe(String(totalPages));

		await waitForLastPageResponse;
		await this.waitForCoursesToRender();
	}

	async getPaginationLabelText(): Promise<string> {
		await expect(this.paginationLabel).toBeVisible();
		return (await this.paginationLabel.textContent())?.trim() ?? "";
	}

	async goToNextPage(): Promise<void> {
		await expect(this.paginationNextButton).toBeVisible();
		const before = await this.getPaginationLabelText();
		await this.paginationNextButton.click();
		await expect(this.paginationLabel).not.toHaveText(before);
		await this.waitForCoursesToRender();
	}

	async goToPreviousPage(): Promise<void> {
		await expect(this.paginationPreviousButton).toBeVisible();
		const before = await this.getPaginationLabelText();
		await this.paginationPreviousButton.click();
		await expect(this.paginationLabel).not.toHaveText(before);
		await this.waitForCoursesToRender();
	}

	private async ensureFiltersResetButtonVisible(): Promise<void> {
		if (await this.filtersResetButton.isVisible()) {
			return;
		}

		if (await this.filtersDrawerTrigger.isVisible()) {
			await this.openFiltersDrawer();
			await expect(this.filtersResetButton).toBeVisible();
			return;
		}

		throw new Error("Filters reset button is not visible");
	}

	private async waitForCoursesToRender(): Promise<void> {
		await expect(this.coursesTable).toBeVisible();

		await expect
			.poll(async () => {
				const isEmpty = await this.page
					.getByTestId(testIds.courses.emptyState)
					.isVisible();
				if (isEmpty) {
					return "empty";
				}

				const rowCount = await this.coursesTable
					.getByTestId(testIds.courses.tableRow)
					.count();
				if (rowCount > 0) {
					return "rows";
				}

				return "";
			})
			.not.toBe("");
	}
}
