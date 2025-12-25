import { expect, type Locator, test } from "@playwright/test";

import { MyRatingsPage } from "./my-ratings.page";
import { CourseDetailsPage } from "../courses/course-details.page";
import { waitForPageReady } from "../framework/common";
import { createTestRatingData } from "../framework/test-config";
import { RatingModal } from "../shared/rating-modal.component";

test.describe("Rating modal functionality", () => {
	let coursePage: CourseDetailsPage;
	let ratingModal: RatingModal;
	let myRatingsPage: MyRatingsPage;

	test.beforeEach(async ({ page }) => {
		coursePage = new CourseDetailsPage(page);
		ratingModal = new RatingModal(page);
		myRatingsPage = new MyRatingsPage(page);

		await myRatingsPage.goto();
		await myRatingsPage.openFirstCourseToRate();

		await waitForPageReady(page);
	});

	test("rating modal submission and deletion afterwards", async () => {
		let createdRating = false;
		let comment = "";
		let reviewCard: Locator | undefined;
		let mainError: unknown;

		try {
			expect(await coursePage.isRateButtonVisible()).toBe(true);
			await coursePage.clickRateButton();
			expect(await ratingModal.isVisible()).toBe(true);
			expect(await ratingModal.isTitleVisible()).toBe(true);

			comment = `e2e:${test.info().title}:${String(Date.now())}`;
			const testData = createTestRatingData({ comment });

			// Set difficulty and usefulness
			const initialDifficulty = await ratingModal.getCurrentDifficultyValue();
			const initialUsefulness = await ratingModal.getCurrentUsefulnessValue();

			const targetDifficulty = Math.min(initialDifficulty + 1, 5);
			const targetUsefulness = Math.min(initialUsefulness + 1, 5);

			await ratingModal.setDifficultyRating(targetDifficulty);
			await ratingModal.setUsefulnessRating(targetUsefulness);

			// Set comment
			await ratingModal.setComment(testData.comment);

			// Submit
			await ratingModal.submitRating();
			await ratingModal.waitForHidden();
			createdRating = true;

			// Verify review appears on page
			reviewCard = await coursePage.findReviewCardByText(testData.comment);
			await expect(reviewCard).toBeVisible();
		} catch (error) {
			mainError = error;
		}

		if (createdRating) {
			try {
				await coursePage.deleteUserRating();
				if (reviewCard) {
					await expect(reviewCard).toBeHidden();
				}
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
