import { expect, test } from "@playwright/test";

import { testIds } from "@/lib/test-ids";
import { MyRatingsPage } from "./my-ratings.page";
import { CourseDetailsPage } from "../courses/course-details.page";
import { createTestRatingData } from "../framework/test-config";
import { setFeatureFlagOverride } from "../shared/feature-flags";
import { RatingModal } from "../shared/rating-modal.component";

test.describe("Rating instructor multi-select", () => {
	let coursePage: CourseDetailsPage;
	let ratingModal: RatingModal;
	let myRatingsPage: MyRatingsPage;

	test.beforeEach(async ({ page }) => {
		// The multi-select UI is gated behind this flag; force it on for the test.
		await setFeatureFlagOverride(page, "fe_instructor_multiselect", true);

		coursePage = new CourseDetailsPage(page);
		ratingModal = new RatingModal(page);
		myRatingsPage = new MyRatingsPage(page);

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
	}) => {
		let createdRating = false;
		let mainError: unknown;

		try {
			await coursePage.clickRateButton();
			await expect(page.getByTestId(testIds.rating.modal)).toBeVisible();

			const testData = createTestRatingData({
				comment: `e2e:instructor:${String(Date.now())}`,
			});
			await ratingModal.setDifficultyRating(testData.difficulty);
			await ratingModal.setUsefulnessRating(testData.usefulness);
			await ratingModal.setComment(testData.comment);

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
			createdRating = true;

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
		} catch (error) {
			mainError = error;
		}

		if (createdRating) {
			try {
				await coursePage.deleteUserRating();
			} catch (cleanupError) {
				if (!mainError) {
					throw cleanupError;
				}
				console.warn("Failed to cleanup rating created by test", cleanupError);
			}
		}

		if (mainError) {
			throw mainError;
		}
	});
});
