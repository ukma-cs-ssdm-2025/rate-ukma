import { expect, test } from "@playwright/test";

import { testIds } from "@/lib/test-ids";
import { MyRatingsPage } from "./my-ratings.page";
import { CourseDetailsPage } from "../courses/course-details.page";
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

			// --- select one ---
			await ratingModal.openInstructorPicker();
			await ratingModal.selectInstructorOptionByIndex(0);
			await ratingModal.closeInstructorPicker();
			expect(await ratingModal.getSelectedInstructorCount()).toBe(1);

			// --- select two ---
			await ratingModal.openInstructorPicker();
			await ratingModal.selectInstructorOptionByIndex(1);
			await ratingModal.closeInstructorPicker();
			expect(await ratingModal.getSelectedInstructorCount()).toBe(2);

			const savedNames = (
				await ratingModal.getSelectedInstructorNames()
			).sort();

			// --- deselect one ---
			await ratingModal.removeInstructorChipByIndex(0);
			expect(await ratingModal.getSelectedInstructorCount()).toBe(1);

			// --- deselect all ---
			await ratingModal.removeInstructorChipByIndex(0);
			expect(await ratingModal.getSelectedInstructorCount()).toBe(0);

			// re-select the same two and persist them
			await ratingModal.openInstructorPicker();
			await ratingModal.selectInstructorOptionByIndex(0);
			await ratingModal.selectInstructorOptionByIndex(1);
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
