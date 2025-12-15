import { expect, type Locator, type Page, test } from "@playwright/test";

import { testIds } from "@/lib/test-ids";
import { CoursesPage } from "./components";

test.describe("Courses filters", () => {
	test("reset clears active filters (search query)", async ({ page }) => {
		const coursesPage = new CoursesPage(page);
		await coursesPage.goto();

		const query = "Методи розробки програмних систем";
		await coursesPage.searchByTitle(query);

		await expect(page.getByTestId(testIds.filters.resetButton)).toBeVisible();
		await coursesPage.resetFilters();

		await expect(page.getByTestId(testIds.courses.searchInput)).toHaveValue("");
		expect(getSearchParam(page, "q")).toBe("");
	});

	test("desktop: filters update courses API requests", async ({ page }) => {
		const coursesPage = new CoursesPage(page);
		await coursesPage.goto();

		const panel = page.getByTestId(testIds.filters.panel);
		await expect(panel).toBeVisible();

		await applyAndAssertAllFilters({ page, scope: panel });

		await resetFilters({ page, scope: panel });
		await coursesPage.waitForTableReady();
	});

	test.describe("mobile drawer", () => {
		test.use({ viewport: { width: 390, height: 844 } });

		test("opens and closes filters drawer", async ({ page }) => {
			const coursesPage = new CoursesPage(page);
			await coursesPage.goto();

			await coursesPage.openFiltersDrawer();
			await expect(page.getByTestId(testIds.filters.drawer)).toBeVisible();

			await coursesPage.closeFiltersDrawer();
			await expect(page.getByTestId(testIds.filters.drawer)).toBeHidden();
		});

		test("mobile: filters update courses API requests", async ({ page }) => {
			const coursesPage = new CoursesPage(page);
			await coursesPage.goto();

			await coursesPage.openFiltersDrawer();
			const drawer = page.getByTestId(testIds.filters.drawer);
			await expect(drawer).toBeVisible();

			await applyAndAssertAllFilters({ page, scope: drawer });
			await resetFilters({ page, scope: drawer });

			await coursesPage.closeFiltersDrawer();
			await coursesPage.waitForTableReady();
		});
	});
});

async function applyAndAssertAllFilters({
	page,
	scope,
}: {
	page: Page;
	scope: Locator;
}): Promise<void> {
	const waitForFilteredRequest = waitForCoursesApiParam(page, (params) => {
		const hasDifficulty =
			params.has("avg_difficulty_min") || params.has("avg_difficulty_max");
		const hasUsefulness =
			params.has("avg_usefulness_min") || params.has("avg_usefulness_max");

		return (
			hasDifficulty &&
			hasUsefulness &&
			params.has("semester_term") &&
			params.has("semester_year") &&
			params.has("type_kind") &&
			params.has("faculty") &&
			params.has("department") &&
			params.has("speciality")
		);
	});

	await test.step("difficulty slider", async () => {
		await nudgeRangeFilter({
			page,
			scope,
			sliderTestId: testIds.filters.difficultySlider,
			uiParamKey: "diff",
		});
	});

	await test.step("usefulness slider", async () => {
		await nudgeRangeFilter({
			page,
			scope,
			sliderTestId: testIds.filters.usefulnessSlider,
			uiParamKey: "use",
		});
	});

	await test.step("semester term", async () => {
		await selectSecondRadixSelectOption({
			page,
			scope,
			triggerTestId: testIds.filters.termSelect,
			uiParamKey: "term",
		});
	});

	await test.step("semester year", async () => {
		await selectSecondRadixSelectOption({
			page,
			scope,
			triggerTestId: testIds.filters.yearSelect,
			uiParamKey: "year",
		});
	});

	await test.step("course type", async () => {
		await selectSecondRadixSelectOption({
			page,
			scope,
			triggerTestId: testIds.filters.typeSelect,
			uiParamKey: "type",
		});
	});

	await test.step("faculty/department/speciality", async () => {
		await selectFacultyWithDepartmentsAndSpecialities({ page, scope });

		await selectSecondComboboxOption({
			page,
			scope,
			triggerTestId: testIds.filters.departmentSelect,
			uiParamKey: "dept",
		});

		await selectSecondComboboxOption({
			page,
			scope,
			triggerTestId: testIds.filters.specialitySelect,
			uiParamKey: "spec",
		});
	});

	await expect(scope.getByTestId(testIds.filters.resetButton)).toBeVisible();
	await expect(scope.getByTestId(testIds.filters.resetButton)).toBeEnabled();
	// Filters reset pagination to page=1 (and clearOnDefault removes param)
	expect(getSearchParam(page, "page")).toBe("");

	await waitForFilteredRequest;
}

async function resetFilters({
	page,
	scope,
}: {
	page: Page;
	scope: Locator;
}): Promise<void> {
	await clickWithRetries(scope.getByTestId(testIds.filters.resetButton));

	await expect
		.poll(() => getSearchParam(page, "q"), { timeout: 30_000 })
		.toBe("");
	await expect
		.poll(() => getSearchParam(page, "diff"), { timeout: 30_000 })
		.toBe("");
	await expect
		.poll(() => getSearchParam(page, "use"), { timeout: 30_000 })
		.toBe("");
	await expect
		.poll(() => getSearchParam(page, "term"), { timeout: 30_000 })
		.toBe("");
	await expect
		.poll(() => getSearchParam(page, "year"), { timeout: 30_000 })
		.toBe("");
	await expect
		.poll(() => getSearchParam(page, "type"), { timeout: 30_000 })
		.toBe("");
	await expect
		.poll(() => getSearchParam(page, "faculty"), { timeout: 30_000 })
		.toBe("");
	await expect
		.poll(() => getSearchParam(page, "dept"), { timeout: 30_000 })
		.toBe("");
	await expect
		.poll(() => getSearchParam(page, "spec"), { timeout: 30_000 })
		.toBe("");
}

function getSearchParam(page: Page, key: string): string {
	return new URL(page.url()).searchParams.get(key) ?? "";
}

async function clickWithRetries(
	locator: Locator,
	maxRetries = 3,
): Promise<void> {
	for (let i = 0; i < maxRetries; i++) {
		try {
			await locator.click();
			return;
		} catch (error) {
			if (i === maxRetries - 1) {
				throw error;
			}
		}
	}
}

function waitForCoursesApiParam(
	page: Page,
	predicate: (params: URLSearchParams) => boolean,
): Promise<void> {
	return page
		.waitForRequest(
			(request) => {
				if (request.method() !== "GET") return false;
				if (!request.url().includes("/api/v1/courses/")) return false;
				try {
					const url = new URL(request.url());
					return predicate(url.searchParams);
				} catch {
					return false;
				}
			},
			{ timeout: 30_000 },
		)
		.then(() => undefined);
}

async function openRadixSelectContent(
	page: Page,
	trigger: Locator,
): Promise<Locator> {
	const overlayId = await trigger.getAttribute("aria-controls");
	const content = overlayId
		? page.locator(`#${overlayId}`)
		: page.locator("[data-slot='select-content']:visible").last();
	await expect(content).toBeVisible({ timeout: 30_000 });
	return content;
}

async function openComboboxList(
	page: Page,
	trigger: Locator,
): Promise<Locator> {
	const overlayId = await trigger.getAttribute("aria-controls");
	const content = overlayId
		? page.locator(`#${overlayId}`)
		: page.locator("[data-slot='popover-content']:visible").last();
	const list = content.locator("[data-slot='command-list']");
	await expect(list).toBeVisible({ timeout: 30_000 });
	return list;
}

async function selectSecondRadixSelectOption({
	page,
	scope,
	triggerTestId,
	uiParamKey,
}: {
	page: Page;
	scope: Locator;
	triggerTestId: string;
	uiParamKey: string;
}): Promise<void> {
	const trigger = scope.getByTestId(triggerTestId);
	await trigger.scrollIntoViewIfNeeded();

	await page.keyboard.press("Escape");
	await clickWithRetries(trigger);

	const content = await openRadixSelectContent(page, trigger);
	const items = content.locator("[data-slot='select-item']");
	const count = await items.count();
	if (count < 2) {
		await page.keyboard.press("Escape");
		throw new Error(
			`Expected at least 2 select options for ${triggerTestId} but got ${String(count)}`,
		);
	}

	await clickWithRetries(items.nth(1));

	await expect
		.poll(() => getSearchParam(page, uiParamKey), { timeout: 30_000 })
		.not.toBe("");
}

async function selectFacultyWithDepartmentsAndSpecialities({
	page,
	scope,
}: {
	page: Page;
	scope: Locator;
}): Promise<void> {
	const triggerTestId = testIds.filters.facultySelect;
	const trigger = scope.getByTestId(triggerTestId);
	await trigger.scrollIntoViewIfNeeded();

	for (let i = 1; i < 12; i++) {
		await page.keyboard.press("Escape");
		await clickWithRetries(trigger);

		const list = await openComboboxList(page, trigger);
		const items = list.locator("[data-slot='command-item']");
		const count = await items.count();
		if (count < 2) {
			await page.keyboard.press("Escape");
			throw new Error(
				`Expected at least 2 faculty options for ${triggerTestId} but got ${String(count)}`,
			);
		}

		const optionIndex = Math.min(i, count - 1);

		const waitFaculty = waitForCoursesApiParam(page, (params) =>
			params.has("faculty"),
		);
		await items.nth(optionIndex).click();

		await expect
			.poll(() => getSearchParam(page, "faculty"), { timeout: 30_000 })
			.not.toBe("");
		await waitFaculty;

		const deptOptions = await getComboboxOptionsCount({
			page,
			scope,
			triggerTestId: testIds.filters.departmentSelect,
		});
		const specOptions = await getComboboxOptionsCount({
			page,
			scope,
			triggerTestId: testIds.filters.specialitySelect,
		});

		if (deptOptions >= 2 && specOptions >= 2) {
			return;
		}
	}

	throw new Error(
		"Could not find a faculty with at least one department and speciality option",
	);
}

async function getComboboxOptionsCount({
	page,
	scope,
	triggerTestId,
}: {
	page: Page;
	scope: Locator;
	triggerTestId: string;
}): Promise<number> {
	const trigger = scope.getByTestId(triggerTestId);
	await trigger.scrollIntoViewIfNeeded();

	await page.keyboard.press("Escape");
	await clickWithRetries(trigger);

	const list = await openComboboxList(page, trigger);
	const count = await list.locator("[data-slot='command-item']").count();

	await page.keyboard.press("Escape");
	await expect(list).toBeHidden();

	return count;
}

async function selectSecondComboboxOption({
	page,
	scope,
	triggerTestId,
	uiParamKey,
}: {
	page: Page;
	scope: Locator;
	triggerTestId: string;
	uiParamKey: string;
}): Promise<void> {
	const trigger = scope.getByTestId(triggerTestId);
	await trigger.scrollIntoViewIfNeeded();

	await page.keyboard.press("Escape");
	await clickWithRetries(trigger);

	const list = await openComboboxList(page, trigger);
	const items = list.locator("[data-slot='command-item']");
	const count = await items.count();
	if (count < 2) {
		await page.keyboard.press("Escape");
		throw new Error(
			`Expected at least 2 combobox options for ${triggerTestId} but got ${String(count)}`,
		);
	}

	await clickWithRetries(items.nth(1));

	await expect
		.poll(() => getSearchParam(page, uiParamKey), { timeout: 30_000 })
		.not.toBe("");
}

async function nudgeRangeFilter({
	page,
	scope,
	sliderTestId,
	uiParamKey,
}: {
	page: Page;
	scope: Locator;
	sliderTestId: string;
	uiParamKey: string;
}): Promise<void> {
	const slider = scope.getByTestId(sliderTestId);
	await slider.scrollIntoViewIfNeeded();

	const handles = slider.getByRole("slider");
	const count = await handles.count();
	if (count === 0) {
		throw new Error(`No slider handles found for ${sliderTestId}`);
	}

	const box = await slider.boundingBox();
	if (!box) {
		throw new Error(`Could not get bounding box for ${sliderTestId}`);
	}

	// Use a pointer interaction to trigger Slider "commit".
	await page.mouse.click(box.x + box.width * 0.8, box.y + box.height / 2);

	await expect
		.poll(() => getSearchParam(page, uiParamKey), {
			timeout: 30_000,
		})
		.not.toBe("");
}
