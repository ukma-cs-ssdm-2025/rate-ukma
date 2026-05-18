import { expect, type Locator, test } from "@playwright/test";

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

	test("pick two instructors via multi-select and submit", async ({ page }) => {
		let createdRating = false;
		let reviewCard: Locator | undefined;
		let mainError: unknown;

		try {
			await coursePage.clickRateButton();
			await expect(page.getByTestId(testIds.rating.modal)).toBeVisible();

			const comment = `e2e:instructor:${String(Date.now())}`;
			const testData = createTestRatingData({ comment });

			await ratingModal.setDifficultyRating(testData.difficulty);
			await ratingModal.setUsefulnessRating(testData.usefulness);
			await ratingModal.setComment(testData.comment);

			await ratingModal.openInstructorPicker();
			const list = page.getByTestId(
				`${testIds.rating.instructorMultiSelect}-list`,
			);
			const firstThree = list.locator("[role='option']");
			await expect(firstThree.first()).toBeVisible();
			const optionCount = Math.min(2, await firstThree.count());

			for (let i = 0; i < optionCount; i++) {
				await firstThree.nth(i).click();
			}

			await ratingModal.closeInstructorPicker();

			const chips = page
				.getByTestId(testIds.rating.instructorMultiSelect)
				.locator("span[class*='bg-secondary']");
			await expect(chips).toHaveCount(optionCount);

			await ratingModal.submitRating();
			await ratingModal.waitForHidden();
			createdRating = true;

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
