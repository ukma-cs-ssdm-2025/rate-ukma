import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { testIds } from "@/lib/test-ids";
import { BasePage } from "./base-page";

export interface RatingData {
	difficulty: number;
	usefulness: number;
	comment: string;
}

export class RatingModal extends BasePage {
	// Modal
	private readonly modal: Locator;
	private readonly modalTitle: Locator;

	// Form
	private readonly difficultySlider: Locator;
	private readonly usefulnessSlider: Locator;
	private readonly commentTextarea: Locator;

	// Action buttons
	private readonly saveButton: Locator;

	constructor(page: Page) {
		super(page);

		this.modal = page.getByTestId(testIds.rating.modal);
		this.modalTitle = this.modal.locator("[data-slot='dialog-title']");

		this.difficultySlider = page
			.getByTestId(testIds.rating.difficultySlider)
			.getByRole("slider")
			.first();
		this.usefulnessSlider = page
			.getByTestId(testIds.rating.usefulnessSlider)
			.getByRole("slider")
			.first();
		this.commentTextarea = page.getByTestId(testIds.rating.commentTextarea);

		this.saveButton = page.getByTestId(testIds.rating.submitButton);
	}

	async isVisible(): Promise<boolean> {
		try {
			await this.waitForElement(this.modal, 10000);
			return true;
		} catch {
			return false;
		}
	}

	async isTitleVisible(): Promise<boolean> {
		try {
			await this.waitForElement(this.modalTitle, 10000);
			return true;
		} catch {
			return false;
		}
	}

	async waitForHidden(): Promise<void> {
		await this.modal.waitFor({ state: "hidden" });
	}

	private async getSliderValue(slider: Locator): Promise<number> {
		await this.waitForElement(slider);
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
		await this.waitForElement(slider);

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
		await this.waitForElement(this.commentTextarea);
		await this.fillWithRetry(this.commentTextarea, comment);
	}

	async submitRating(): Promise<void> {
		await this.waitForElement(this.saveButton);
		await this.clickWithRetry(this.saveButton);
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
