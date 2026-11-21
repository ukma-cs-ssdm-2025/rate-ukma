import { test as base, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import type { CourseList, CourseListResponse } from "@/lib/api/generated";
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
	courseWithoutRatings: CourseList;
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
	courseWithoutRatings: async ({ request }, use) => {
		const response = await request.get("/api/v1/courses/", {
			params: { last_review_order: "desc", page_size: 100 },
		});
		if (!response.ok()) {
			throw new Error(
				`Course list request failed with HTTP ${response.status()}`,
			);
		}
		const { items } = (await response.json()) as CourseListResponse;
		const course = [...items]
			.reverse()
			.find((item) => item.ratings_count === 0);
		if (!course) {
			test.skip(
				true,
				"The API returned no course without ratings, so the no-ratings checks cannot run.",
			);
			return;
		}
		await use(course);
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
