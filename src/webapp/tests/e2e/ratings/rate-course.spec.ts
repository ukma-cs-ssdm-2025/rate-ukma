import { testIds } from "@/lib/test-ids";
import { expect, test } from "../framework/fixtures";
import { createTestRatingData } from "../framework/test-config";

test.describe("Rating modal functionality", () => {
	test.beforeEach(async ({ page, myRatingsPage }) => {
		await myRatingsPage.goto();
		await myRatingsPage.openFirstCourseToRate();

		await expect(page.getByTestId(testIds.courseDetails.title)).toBeVisible();
	});

	test("rating modal submission and deletion afterwards @smoke", async ({
		page,
		coursePage,
		ratingModal,
		ratingCleanup,
	}) => {
		await coursePage.clickRateButton();
		await expect(page.getByTestId(testIds.rating.modal)).toBeVisible();
		await expect(page.getByTestId(testIds.rating.modalTitle)).toBeVisible();

		const comment = `e2e:${test.info().title}:${String(Date.now())}`;
		const testData = createTestRatingData({ comment });

		const initialDifficulty = await ratingModal.getCurrentDifficultyValue();
		const initialUsefulness = await ratingModal.getCurrentUsefulnessValue();

		const targetDifficulty = Math.min(initialDifficulty + 1, 5);
		const targetUsefulness = Math.min(initialUsefulness + 1, 5);

		await ratingModal.setDifficultyRating(targetDifficulty);
		await ratingModal.setUsefulnessRating(targetUsefulness);

		await ratingModal.setComment(testData.comment);

		await ratingModal.submitRating();
		await ratingModal.waitForHidden();
		ratingCleanup.markCreated();

		const reviewCard = await coursePage.findReviewCardByText(testData.comment);
		await expect(reviewCard).toBeVisible();
	});
});
