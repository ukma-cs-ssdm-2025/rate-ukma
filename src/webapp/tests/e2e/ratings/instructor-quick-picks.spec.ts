import { expect, test } from "@playwright/test";

import { testIds } from "@/lib/test-ids";
import { MyRatingsPage } from "./my-ratings.page";
import { CourseDetailsPage } from "../courses/course-details.page";
import { createTestRatingData } from "../framework/test-config";
import { RatingModal } from "../shared/rating-modal.component";

test.describe("Rating instructor quick picks", () => {
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

	// Our own saved rating names a teacher on this offering, which is enough
	// for a pick. Unselecting that teacher in the edit modal must bring the
	// pick back, and tapping it must re-add the teacher.
	test("offers a teacher named on this offering and adds it in one tap", async ({
		page,
	}) => {
		let createdRating = false;
		let mainError: unknown;

		try {
			await coursePage.clickRateButton();
			await expect(page.getByTestId(testIds.rating.modal)).toBeVisible();

			const testData = createTestRatingData({
				comment: `e2e:quick-pick:${String(Date.now())}`,
			});
			await ratingModal.setDifficultyRating(testData.difficulty);
			await ratingModal.setUsefulnessRating(testData.usefulness);
			await ratingModal.setComment(testData.comment);

			await ratingModal.openInstructorPicker();
			const [teacherName] = await ratingModal.getListedInstructorNames(1);
			expect(teacherName).toBeTruthy();
			await ratingModal.pickInstructorByText(teacherName);
			await ratingModal.closeInstructorPicker();
			expect(await ratingModal.getSelectedInstructorNames()).toEqual([
				teacherName,
			]);

			await ratingModal.submitRating();
			await ratingModal.waitForHidden();
			createdRating = true;

			await coursePage.clickEditUserRating();
			await expect(page.getByTestId(testIds.rating.modal)).toBeVisible();
			expect(await ratingModal.getSelectedInstructorNames()).toEqual([
				teacherName,
			]);
			// A teacher already in the field is never offered again.
			await expect(ratingModal.instructorQuickPick(teacherName)).toHaveCount(0);

			await ratingModal.removeInstructorChipByIndex(0);
			expect(await ratingModal.getSelectedInstructorCount()).toBe(0);

			const pick = ratingModal.instructorQuickPick(teacherName);
			await expect(pick).toBeVisible();
			await pick.click();

			expect(await ratingModal.getSelectedInstructorNames()).toEqual([
				teacherName,
			]);
			await expect(pick).toHaveCount(0);

			await page.keyboard.press("Escape");
			await ratingModal.waitForHidden();
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
