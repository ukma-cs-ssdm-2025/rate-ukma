import { test as base, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { testIds } from "@/lib/test-ids";
import { CourseDetailsPage } from "../courses/course-details.page";
import { MyRatingsPage } from "../ratings/my-ratings.page";
import { RatingModal } from "../shared/rating-modal.component";

export interface RatingCleanup {
	markCreated(): void;
}

interface Fixtures {
	coursePage: CourseDetailsPage;
	myRatingsPage: MyRatingsPage;
	ratingModal: RatingModal;
	ratingCleanup: RatingCleanup;
}

export const test = base.extend<Fixtures>({
	coursePage: async ({ page }, use) => {
		await use(new CourseDetailsPage(page));
	},
	myRatingsPage: async ({ page }, use) => {
		await use(new MyRatingsPage(page));
	},
	ratingModal: async ({ page }, use) => {
		await use(new RatingModal(page));
	},
	ratingCleanup: async ({ page, coursePage }, use) => {
		let created = false;
		await use({
			markCreated: () => {
				created = true;
			},
		});
		if (!created) {
			return;
		}
		await closeRatingModal(page);
		await coursePage.deleteUserRating();
		await coursePage.expectNoUserRating();
	},
});

export { expect };

async function closeRatingModal(page: Page): Promise<void> {
	const modal = page.getByTestId(testIds.rating.modal);
	for (let attempt = 0; attempt < 2 && (await modal.isVisible()); attempt++) {
		await page.keyboard.press("Escape");
	}
	await modal.waitFor({ state: "hidden" });
}
