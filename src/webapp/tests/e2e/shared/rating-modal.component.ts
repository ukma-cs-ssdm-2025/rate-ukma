import { expect, type Locator, type Page } from "@playwright/test";

import { testIds } from "@/lib/test-ids";

export interface RatingData {
	difficulty: number;
	usefulness: number;
	comment: string;
}

export class RatingModal {
	private readonly page: Page;
	// Modal
	private readonly modal: Locator;

	// Form
	private readonly difficultySlider: Locator;
	private readonly usefulnessSlider: Locator;
	private readonly commentTextarea: Locator;

	// Action buttons
	private readonly saveButton: Locator;

	constructor(page: Page) {
		this.page = page;

		this.modal = page.getByTestId(testIds.rating.modal);
		this.difficultySlider = page.getByTestId(
			`${testIds.rating.difficultySlider}-thumb-0`,
		);
		this.usefulnessSlider = page.getByTestId(
			`${testIds.rating.usefulnessSlider}-thumb-0`,
		);
		this.commentTextarea = page.getByTestId(testIds.rating.commentTextarea);

		this.saveButton = page.getByTestId(testIds.rating.submitButton);
	}

	async waitForHidden(): Promise<void> {
		await this.modal.waitFor({ state: "hidden" });
	}

	private async getSliderValue(slider: Locator): Promise<number> {
		await expect(slider).toBeVisible();
		const raw = await slider.getAttribute("aria-valuenow");
		if (!raw) {
			throw new Error("Slider aria-valuenow is missing");
		}
		const value = Number(raw);
		if (Number.isNaN(value)) {
			throw new Error(`Slider aria-valuenow is not a number: ${raw}`);
		}
		return value;
	}

	private async setSliderValue(
		slider: Locator,
		targetValue: number,
	): Promise<void> {
		await expect(slider).toBeVisible();

		const currentValue = await this.getSliderValue(slider);
		const steps = targetValue - currentValue;
		if (steps === 0) {
			return;
		}

		await slider.focus();

		const direction = steps > 0 ? "ArrowRight" : "ArrowLeft";
		const stepDelta = steps > 0 ? 1 : -1;

		let expectedValue = currentValue;
		for (let i = 0; i < Math.abs(steps); i++) {
			expectedValue += stepDelta;
			await this.page.keyboard.press(direction);
			await expect(slider).toHaveAttribute(
				"aria-valuenow",
				String(expectedValue),
			);
		}

		const newValue = await this.getSliderValue(slider);
		if (newValue !== targetValue) {
			throw new Error(
				`Slider value not set correctly. Expected: ${targetValue}, Got: ${newValue}`,
			);
		}
	}

	async getCurrentDifficultyValue(): Promise<number> {
		return await this.getSliderValue(this.difficultySlider);
	}

	async setDifficultyRating(targetValue: number): Promise<void> {
		await this.setSliderValue(this.difficultySlider, targetValue);
	}

	async getCurrentUsefulnessValue(): Promise<number> {
		return await this.getSliderValue(this.usefulnessSlider);
	}

	async setUsefulnessRating(targetValue: number): Promise<void> {
		await this.setSliderValue(this.usefulnessSlider, targetValue);
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
