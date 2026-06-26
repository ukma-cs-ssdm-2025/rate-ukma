import { expect, test } from "@playwright/test";

import { testIds } from "@/lib/test-ids";
import { MyRatingsPage } from "./my-ratings.page";
import { CourseDetailsPage } from "../courses/course-details.page";
import { createTestRatingData } from "../framework/test-config";
import { setFeatureFlagOverride } from "../shared/feature-flags";
import { RatingModal } from "../shared/rating-modal.component";

// Regression: with the multi-select flag OFF, the rating form must keep the
// legacy free-text instructor input and the old write path must work end to end.
test.describe("Rating instructor — legacy free-text (flag off)", () => {
	let coursePage: CourseDetailsPage;
	let ratingModal: RatingModal;
	let myRatingsPage: MyRatingsPage;

	test.beforeEach(async ({ page }) => {
		await setFeatureFlagOverride(page, "fe_instructor_multiselect", false);

		coursePage = new CourseDetailsPage(page);
		ratingModal = new RatingModal(page);
		myRatingsPage = new MyRatingsPage(page);

		await myRatingsPage.goto();
		await myRatingsPage.openFirstCourseToRate();
		await expect(page.getByTestId(testIds.courseDetails.title)).toBeVisible();
	});

	test("shows the text input (not the multi-select), saves and re-populates it", async ({
		page,
	}) => {
		let createdRating = false;
		let mainError: unknown;

		try {
			await coursePage.clickRateButton();
			await expect(page.getByTestId(testIds.rating.modal)).toBeVisible();

			// The legacy text input is shown; the multi-select is not rendered.
			await expect(ratingModal.instructorTextInputLocator()).toBeVisible();
			await expect(ratingModal.instructorMultiSelectLocator()).toBeHidden();

			const testData = createTestRatingData({
				comment: `e2e:instructor-legacy:${String(Date.now())}`,
			});
			const instructorName = `Викладач ${String(Date.now())}`;

			await ratingModal.setDifficultyRating(testData.difficulty);
			await ratingModal.setUsefulnessRating(testData.usefulness);
			await ratingModal.setComment(testData.comment);
			await ratingModal.fillInstructorText(instructorName);

			await ratingModal.submitRating();
			await ratingModal.waitForHidden();
			createdRating = true;

			// Re-open edit: the saved free-text instructor must pre-populate.
			await coursePage.clickEditUserRating();
			await expect(page.getByTestId(testIds.rating.modal)).toBeVisible();
			await expect(ratingModal.instructorTextInputLocator()).toBeVisible();
			expect(await ratingModal.getInstructorTextValue()).toBe(instructorName);

			// Close the edit modal so the cleanup can reach the card's delete button
			// (an open modal overlay would intercept the click).
			await ratingModal.cancel();
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
