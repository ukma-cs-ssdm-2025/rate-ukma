import { expect, type Locator, type Page } from "@playwright/test";

import { testIds } from "@/lib/test-ids";

export interface RatingData {
	difficulty: number;
	usefulness: number;
	comment: string;
}

export class RatingModal {
	// Modal
	private readonly modal: Locator;

	// Form — star rating inputs
	private readonly difficultyStars: Locator;
	private readonly usefulnessStars: Locator;
	private readonly commentTextarea: Locator;

	// Action buttons
	private readonly saveButton: Locator;

	constructor(page: Page) {
		this.modal = page.getByTestId(testIds.rating.modal);
		this.difficultyStars = page.getByTestId(testIds.rating.difficultySlider);
		this.usefulnessStars = page.getByTestId(testIds.rating.usefulnessSlider);
		this.commentTextarea = page.getByTestId(testIds.rating.commentTextarea);

		this.saveButton = page.getByTestId(testIds.rating.submitButton);
	}

	async waitForHidden(): Promise<void> {
		await this.modal.waitFor({ state: "hidden" });
	}

	private async getStarValue(container: Locator): Promise<number> {
		await expect(container).toBeVisible();
		const filledStars = container.locator("button:has(svg.fill-primary)");
		return await filledStars.count();
	}

	private async setStarValue(
		container: Locator,
		targetValue: number,
	): Promise<void> {
		await expect(container).toBeVisible();

		if (targetValue < 1 || targetValue > 5) {
			throw new RangeError(
				`Star value must be between 1 and 5, got: ${targetValue}`,
			);
		}

		const starButton = container.locator("button").nth(targetValue - 1);
		await starButton.click();
	}

	async getCurrentDifficultyValue(): Promise<number> {
		return await this.getStarValue(this.difficultyStars);
	}

	async setDifficultyRating(targetValue: number): Promise<void> {
		await this.setStarValue(this.difficultyStars, targetValue);
	}

	async getCurrentUsefulnessValue(): Promise<number> {
		return await this.getStarValue(this.usefulnessStars);
	}

	async setUsefulnessRating(targetValue: number): Promise<void> {
		await this.setStarValue(this.usefulnessStars, targetValue);
	}

	async setComment(comment: string): Promise<void> {
		await expect(this.commentTextarea).toBeVisible();
		await this.commentTextarea.fill(comment);
	}

	async submitRating(): Promise<void> {
		await expect(this.saveButton).toBeVisible();
		await this.saveButton.click();
	}

	async fillRatingForm(data: RatingData): Promise<void> {
		await this.setDifficultyRating(data.difficulty);
		await this.setUsefulnessRating(data.usefulness);
		await this.setComment(data.comment);
	}

	async submitCompleteRating(data: RatingData): Promise<void> {
		await this.fillRatingForm(data);
		await this.submitRating();
		await this.waitForHidden();
	}
}
