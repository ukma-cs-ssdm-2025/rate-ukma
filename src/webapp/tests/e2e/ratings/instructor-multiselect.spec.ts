import type { Page, Response } from "@playwright/test";

import { testIds } from "@/lib/test-ids";
import type { RatingModal } from "../shared/rating-modal.component";
import { expect, test } from "../framework/fixtures";
import { createTestRatingData } from "../framework/test-config";

test.describe("Rating instructor multi-select", () => {
	// Both tests rate the same first unrated course, so they must not overlap.
	test.describe.configure({ mode: "serial" });

	test.beforeEach(async ({ page, myRatingsPage }) => {
		await myRatingsPage.goto();
		await myRatingsPage.openFirstCourseToRate();
		await expect(page.getByTestId(testIds.courseDetails.title)).toBeVisible();
	});

	// Select one, select two, deselect one, deselect all, persist two, then
	// reopen the edit modal and confirm the saved instructors pre-populate
	// (regression: the edit modal used to open with an empty picker), finally
	// clear them all and confirm the cleared state persists.
	test("select, deselect, persist and re-open with saved instructors", async ({
		page,
		coursePage,
		ratingModal,
		ratingCleanup,
	}) => {
		await coursePage.clickRateButton();
		await fillRequiredFields(page, ratingModal, "instructor");

		// Take two real names from the directory instead of hardcoding staff who
		// may be renamed, unrated, or filtered out of the list later.
		await ratingModal.openInstructorPicker();
		const [firstName, secondName] =
			await ratingModal.getListedInstructorNames(2);
		expect(firstName).toBeTruthy();
		expect(secondName).toBeTruthy();
		expect(firstName).not.toBe(secondName);

		// --- select one; regression: chip survives clearing search ---
		await ratingModal.pickInstructorByText(firstName);
		expect(await ratingModal.getSelectedInstructorNames()).toContain(firstName);
		await ratingModal.clearInstructorSearch();
		expect(await ratingModal.getSelectedInstructorNames()).toContain(firstName);
		await ratingModal.closeInstructorPicker();
		expect(await ratingModal.getSelectedInstructorCount()).toBe(1);

		// --- select two ---
		await ratingModal.openInstructorPicker();
		await ratingModal.pickInstructorByText(secondName);
		await ratingModal.closeInstructorPicker();
		expect(await ratingModal.getSelectedInstructorCount()).toBe(2);

		const savedNames = [firstName, secondName].sort();
		expect((await ratingModal.getSelectedInstructorNames()).sort()).toEqual(
			savedNames,
		);

		// --- deselect one ---
		await ratingModal.removeInstructorChipByIndex(0);
		expect(await ratingModal.getSelectedInstructorCount()).toBe(1);

		// --- deselect all ---
		await ratingModal.removeInstructorChipByIndex(0);
		expect(await ratingModal.getSelectedInstructorCount()).toBe(0);

		// re-select the same two and persist them
		await ratingModal.openInstructorPicker();
		await ratingModal.pickInstructorByText(firstName);
		await ratingModal.pickInstructorByText(secondName);
		await ratingModal.closeInstructorPicker();
		expect(await ratingModal.getSelectedInstructorCount()).toBe(2);
		expect((await ratingModal.getSelectedInstructorNames()).sort()).toEqual(
			savedNames,
		);

		await ratingModal.submitRating();
		await ratingModal.waitForHidden();
		ratingCleanup.markCreated();

		// --- regression: re-open edit, saved instructors must be present ---
		await coursePage.clickEditUserRating();
		await expect(page.getByTestId(testIds.rating.modal)).toBeVisible();
		expect(await ratingModal.getSelectedInstructorCount()).toBe(2);
		expect((await ratingModal.getSelectedInstructorNames()).sort()).toEqual(
			savedNames,
		);

		// --- deselect all in edit and persist the cleared state ---
		await ratingModal.removeInstructorChipByIndex(0);
		await ratingModal.removeInstructorChipByIndex(0);
		expect(await ratingModal.getSelectedInstructorCount()).toBe(0);
		await ratingModal.submitRating();
		await ratingModal.waitForHidden();

		// re-open once more: the cleared state must have persisted
		await coursePage.clickEditUserRating();
		await expect(page.getByTestId(testIds.rating.modal)).toBeVisible();
		expect(await ratingModal.getSelectedInstructorCount()).toBe(0);
		await ratingModal.closeInstructorPicker();
		await page.getByTestId(testIds.rating.modal).waitFor({ state: "hidden" });
	});

	// Rate with a teacher that is sure to be offered once our rating is saved.
	// Unselecting that teacher in the edit modal must bring the pick back, and
	// tapping it must re-add the teacher.
	test("offers a teacher named on this offering and adds it in one tap", async ({
		page,
		coursePage,
		ratingModal,
		ratingCleanup,
	}) => {
		const picksLoaded = page.waitForResponse(isCourseInstructorsResponse);
		await coursePage.clickRateButton();
		await picksLoaded;
		await fillRequiredFields(page, ratingModal, "quick-pick");

		// A teacher offered now is in the top two, and our rating only adds to
		// its count. With no picks nobody qualifies yet, so the teacher we name
		// becomes the only one.
		const [offeredName] = await ratingModal.getQuickPickNames();
		let teacherName = offeredName;
		if (teacherName) {
			await ratingModal.instructorQuickPick(teacherName).click();
		} else {
			await ratingModal.openInstructorPicker();
			[teacherName] = await ratingModal.getListedInstructorNames(1);
			expect(teacherName).toBeTruthy();
			await ratingModal.pickInstructorByText(teacherName);
			await ratingModal.closeInstructorPicker();
		}

		await ratingModal.submitRating();
		await ratingModal.waitForHidden();
		ratingCleanup.markCreated();

		await coursePage.clickEditUserRating();
		await expect(page.getByTestId(testIds.rating.modal)).toBeVisible();
		expect(await ratingModal.getSelectedInstructorNames()).toEqual([
			teacherName,
		]);
		// A teacher already in the field is never offered again.
		const pick = ratingModal.instructorQuickPick(teacherName);
		await expect(pick).toHaveCount(0);

		await ratingModal.removeInstructorChipByIndex(0);
		await expect(pick).toBeVisible();
		await pick.click();

		expect(await ratingModal.getSelectedInstructorNames()).toEqual([
			teacherName,
		]);
		await expect(pick).toHaveCount(0);

		await page.keyboard.press("Escape");
		await ratingModal.waitForHidden();
	});
});

async function fillRequiredFields(
	page: Page,
	ratingModal: RatingModal,
	label: string,
): Promise<void> {
	await expect(page.getByTestId(testIds.rating.modal)).toBeVisible();
	const testData = createTestRatingData({
		comment: `e2e:${label}:${String(Date.now())}`,
	});
	await ratingModal.setDifficultyRating(testData.difficulty);
	await ratingModal.setUsefulnessRating(testData.usefulness);
	await ratingModal.setComment(testData.comment);
}

function isCourseInstructorsResponse(response: Response): boolean {
	return /^\/api\/v1\/courses\/[^/]+\/instructors\/$/.test(
		new URL(response.url()).pathname,
	);
}
