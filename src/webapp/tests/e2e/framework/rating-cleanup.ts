import type { Page } from "@playwright/test";

import { testIds } from "@/lib/test-ids";
import type { CourseDetailsPage } from "../courses/course-details.page";

/**
 * Runs `body`, then deletes the rating it created even when the body fails.
 * The body calls `markCreated` right after the rating is saved. An open
 * rating modal is closed first, since it would block the delete button.
 */
export async function withRatingCleanup(
	page: Page,
	coursePage: CourseDetailsPage,
	body: (markCreated: () => void) => Promise<void>,
): Promise<void> {
	let createdRating = false;
	let mainError: unknown;

	try {
		await body(() => {
			createdRating = true;
		});
	} catch (error) {
		mainError = error;
	}

	if (createdRating) {
		try {
			await closeRatingModal(page);
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
}

/** A failed step can leave the modal (and its picker) open over the page. */
async function closeRatingModal(page: Page): Promise<void> {
	const modal = page.getByTestId(testIds.rating.modal);
	for (let attempt = 0; attempt < 2 && (await modal.isVisible()); attempt++) {
		await page.keyboard.press("Escape");
	}
	await modal.waitFor({ state: "hidden" });
}
