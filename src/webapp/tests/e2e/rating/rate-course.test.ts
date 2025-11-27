import { expect, test } from "@playwright/test";

import { navigateToCoursePage, waitForPageReady } from "../components";
import { CourseDetailsPage } from "../components/course-details-page";
import { RatingModal } from "../components/rating-modal";
import { createTestRatingData, TEST_CONFIG } from "../components/test-config";

test.describe("Rating modal functionality", () => {
	let coursePage: CourseDetailsPage;
	let ratingModal: RatingModal;

	test.beforeEach(async ({ page }) => {
		coursePage = new CourseDetailsPage(page);
		ratingModal = new RatingModal(page);

		await navigateToCoursePage(page, TEST_CONFIG.courses.rateCourse);
		await waitForPageReady(page);
	});

	test("rating modal opens when rate button is clicked", async () => {
		expect(await coursePage.isRateButtonVisible()).toBe(true);

		await coursePage.clickRateButton();

		expect(await ratingModal.isVisible()).toBe(true);
		expect(await ratingModal.isTitleVisible()).toBe(true);
	});

	test("rating modal submission and deletion afterwards", async () => {
		expect(await coursePage.isRateButtonVisible()).toBe(true);
		await coursePage.clickRateButton();
		expect(await ratingModal.isVisible()).toBe(true);

		const testData = createTestRatingData();

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

		// Verify review appears on page
		const reviewCard = await coursePage.findReviewCardByText(testData.comment);
		await expect(reviewCard).toBeVisible();

		// Clean up: deleting the rating
		await coursePage.clickRateButton();
		expect(await ratingModal.isVisible()).toBe(true);

		await ratingModal.deleteRating();
		await ratingModal.waitForHidden();

		await expect(reviewCard).toBeHidden();
	});
});
