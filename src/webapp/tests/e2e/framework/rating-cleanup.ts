import type { CourseDetailsPage } from "../courses/course-details.page";

/**
 * Runs `body`, then deletes the rating it created even when the body fails.
 * The body calls `markCreated` right after the rating is saved.
 */
export async function withRatingCleanup(
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
