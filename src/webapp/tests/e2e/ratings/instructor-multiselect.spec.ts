import { expect, type Page, test } from "@playwright/test";

import { testIds } from "@/lib/test-ids";
import { MyRatingsPage } from "./my-ratings.page";
import { CourseDetailsPage } from "../courses/course-details.page";
import { withRatingCleanup } from "../framework/rating-cleanup";
import { createTestRatingData } from "../framework/test-config";
import { RatingModal } from "../shared/rating-modal.component";

test.describe("Rating instructor multi-select", () => {
	let coursePage: CourseDetailsPage;
	let ratingModal: RatingModal;
	let myRatingsPage: MyRatingsPage;

	test.beforeEach(async ({ page }) => {
		coursePage = new CourseDetailsPage(page);
		ratingModal = new RatingModal(page);
		myRatingsPage = new MyRatingsPage(page);

		await myRatingsPage.goto();
		await myRatingsPage.openFirstCourseToRate();
		await expect(page.getByTestId(testIds.courseDetails.title)).toBeVisible();
	});

	async function startRating(page: Page, label: string): Promise<void> {
		await coursePage.clickRateButton();
		await expect(page.getByTestId(testIds.rating.modal)).toBeVisible();

		const testData = createTestRatingData({
			comment: `e2e:${label}:${String(Date.now())}`,
		});
		await ratingModal.setDifficultyRating(testData.difficulty);
		await ratingModal.setUsefulnessRating(testData.usefulness);
		await ratingModal.setComment(testData.comment);
	}

	// Select one, select two, deselect one, deselect all, persist two, then
	// reopen the edit modal and confirm the saved instructors pre-populate
	// (regression: the edit modal used to open with an empty picker), finally
	// clear them all and confirm the cleared state persists.
	test("select, deselect, persist and re-open with saved instructors", async ({
		page,
	}) => {
		await withRatingCleanup(coursePage, async (markCreated) => {
			await startRating(page, "instructor");

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
			expect(await ratingModal.getSelectedInstructorNames()).toContain(
				firstName,
			);
			await ratingModal.clearInstructorSearch();
			expect(await ratingModal.getSelectedInstructorNames()).toContain(
				firstName,
			);
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
			markCreated();

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
	});

	// Our own saved rating names a teacher on this offering, which is enough
	// for a pick. Unselecting that teacher in the edit modal must bring the
	// pick back, and tapping it must re-add the teacher.
	test("offers a teacher named on this offering and adds it in one tap", async ({
		page,
	}) => {
		await withRatingCleanup(coursePage, async (markCreated) => {
			await startRating(page, "quick-pick");

			await ratingModal.openInstructorPicker();
			const [teacherName] = await ratingModal.getListedInstructorNames(1);
			expect(teacherName).toBeTruthy();
			await ratingModal.pickInstructorByText(teacherName);
			await ratingModal.closeInstructorPicker();

			await ratingModal.submitRating();
			await ratingModal.waitForHidden();
			markCreated();

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
});
