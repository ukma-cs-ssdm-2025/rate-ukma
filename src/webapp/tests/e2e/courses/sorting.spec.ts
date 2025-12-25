import { expect, test } from "@playwright/test";

import { getSearchParam } from "../shared/url-assertions";
import { TEST_QUERIES } from "./fixtures/courses";
import { CoursesPage } from "./courses.page";

test.describe("Courses sorting", () => {
	test("difficulty sort cycles asc → desc → cleared", async ({ page }) => {
		const coursesPage = new CoursesPage(page);
		await coursesPage.goto();

		expect(getSearchParam(page, "diffOrder")).toBe("");

		const waitAsc = page.waitForRequest((req) => {
			if (req.method() !== "GET") return false;
			if (!req.url().includes("/api/v1/courses/")) return false;
			return (
				new URL(req.url()).searchParams.get("avg_difficulty_order") === "asc"
			);
		});
		await coursesPage.sortByDifficulty();
		await waitAsc;
		await expect.poll(() => getSearchParam(page, "diffOrder")).toBe("asc");
		// Sorting resets pagination to page=1, which is removed from URL.
		expect(getSearchParam(page, "page")).toBe("");

		const waitDesc = page.waitForRequest((req) => {
			if (req.method() !== "GET") return false;
			if (!req.url().includes("/api/v1/courses/")) return false;
			return (
				new URL(req.url()).searchParams.get("avg_difficulty_order") === "desc"
			);
		});
		await coursesPage.sortByDifficulty();
		await waitDesc;
		await expect.poll(() => getSearchParam(page, "diffOrder")).toBe("desc");

		await coursesPage.sortByDifficulty();
		await expect.poll(() => getSearchParam(page, "diffOrder")).toBe("");
	});

	test("usefulness sort starts from desc", async ({ page }) => {
		const coursesPage = new CoursesPage(page);
		await coursesPage.goto();

		expect(getSearchParam(page, "useOrder")).toBe("");

		const waitDesc = page.waitForRequest((req) => {
			if (req.method() !== "GET") return false;
			if (!req.url().includes("/api/v1/courses/")) return false;
			return (
				new URL(req.url()).searchParams.get("avg_usefulness_order") === "desc"
			);
		});
		await coursesPage.sortByUsefulness();
		await waitDesc;
		await expect.poll(() => getSearchParam(page, "useOrder")).toBe("desc");

		const waitAsc = page.waitForRequest((req) => {
			if (req.method() !== "GET") return false;
			if (!req.url().includes("/api/v1/courses/")) return false;
			return (
				new URL(req.url()).searchParams.get("avg_usefulness_order") === "asc"
			);
		});
		await coursesPage.sortByUsefulness();
		await waitAsc;
		await expect.poll(() => getSearchParam(page, "useOrder")).toBe("asc");
	});

	test("sorting works with search filter", async ({ page }) => {
		const coursesPage = new CoursesPage(page);
		await coursesPage.goto();

		await coursesPage.searchByTitle(TEST_QUERIES.common);
		expect(getSearchParam(page, "q")).toBe(TEST_QUERIES.common);

		const waitCombined = page.waitForRequest((req) => {
			if (req.method() !== "GET") return false;
			if (!req.url().includes("/api/v1/courses/")) return false;
			const params = new URL(req.url()).searchParams;
			return (
				params.get("name") === TEST_QUERIES.common &&
				params.get("avg_usefulness_order") === "desc"
			);
		});
		await coursesPage.sortByUsefulness();
		await waitCombined;

		expect(getSearchParam(page, "q")).toBe(TEST_QUERIES.common);
		expect(getSearchParam(page, "useOrder")).toBe("desc");
	});
});
