import type { Locator, Page } from "@playwright/test";

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
	private readonly difficultyLabel: Locator;
	private readonly difficultySlider: Locator;
	private readonly usefulnessLabel: Locator;
	private readonly usefulnessSlider: Locator;
	private readonly commentTextarea: Locator;

	// Action buttons
	private readonly saveButton: Locator;
	private readonly deleteButton: Locator;
	private readonly confirmDeleteButton: Locator;

	constructor(page: Page) {
		super(page);

		this.modal = page.locator("[role='dialog']");
		this.modalTitle = this.modal
			.locator("h2")
			.filter({ hasText: "Оцінити курс" });

		this.difficultyLabel = page
			.locator("label")
			.filter({ hasText: /^Складність:/ });
		this.difficultySlider = page
			.locator("div[data-slot='form-item']", {
				has: this.difficultyLabel,
			})
			.getByRole("slider");

		this.usefulnessLabel = page
			.locator("label")
			.filter({ hasText: /^Корисність:/ });
		this.usefulnessSlider = page
			.locator("div[data-slot='form-item']", {
				has: this.usefulnessLabel,
			})
			.getByRole("slider");

		this.commentTextarea = page.locator("textarea[name='comment']");

		this.saveButton = page
			.locator("button")
			.filter({ hasText: /Зберегти|Надіслати/ });
		this.deleteButton = page.locator("button").filter({ hasText: /Видалити/ });
		this.confirmDeleteButton = page
			.locator("button.bg-destructive.text-white")
			.filter({
				hasText: "Видалити",
			});
	}

	async isVisible(): Promise<boolean> {
		try {
			await this.waitForElement(this.modal, 5000);
			return true;
		} catch {
			return false;
		}
	}

	async isTitleVisible(): Promise<boolean> {
		try {
			await this.waitForElement(this.modalTitle, 3000);
			return true;
		} catch {
			return false;
		}
	}

	async waitForHidden(): Promise<void> {
		await this.modal.waitFor({ state: "hidden" });
	}

	async getCurrentDifficultyValue(): Promise<number> {
		const text = await this.getTextContent(this.difficultyLabel);
		return this.extractRatingValue(text, "Складність");
	}

	async setDifficultyRating(targetValue: number): Promise<void> {
		await this.waitForElement(this.difficultySlider);

		const currentValue = await this.getCurrentDifficultyValue();

		const steps = targetValue - currentValue;
		if (steps === 0) return; // Already at target value

		// Focus and move slider
		await this.difficultySlider.focus();

		const direction = steps > 0 ? "ArrowRight" : "ArrowLeft";
		const absSteps = Math.abs(steps);

		for (let i = 0; i < absSteps; i++) {
			await this.page.keyboard.press(direction);
			await this.page.waitForTimeout(100);
		}

		const newValue = await this.getCurrentDifficultyValue();
		if (newValue !== targetValue) {
			throw new Error(
				`Difficulty rating not set correctly. Expected: ${targetValue}, Got: ${newValue}`,
			);
		}
	}

	async getCurrentUsefulnessValue(): Promise<number> {
		const text = await this.getTextContent(this.usefulnessLabel);
		return this.extractRatingValue(text, "Корисність");
	}

	async setUsefulnessRating(targetValue: number): Promise<void> {
		await this.waitForElement(this.usefulnessSlider);

		const currentValue = await this.getCurrentUsefulnessValue();

		const steps = targetValue - currentValue;
		if (steps === 0) return; // Already at target value

		await this.usefulnessSlider.focus();

		const direction = steps > 0 ? "ArrowRight" : "ArrowLeft";
		const absSteps = Math.abs(steps);

		for (let i = 0; i < absSteps; i++) {
			await this.page.keyboard.press(direction);
			await this.page.waitForTimeout(100);
		}

		const newValue = await this.getCurrentUsefulnessValue();
		if (newValue !== targetValue) {
			throw new Error(
				`Usefulness rating not set correctly. Expected: ${targetValue}, Got: ${newValue}`,
			);
		}
	}

	async setComment(comment: string): Promise<void> {
		await this.waitForElement(this.commentTextarea);
		await this.fillWithRetry(this.commentTextarea, comment);
	}

	async submitRating(): Promise<void> {
		await this.waitForElement(this.saveButton);
		await this.clickWithRetry(this.saveButton);
	}

	async deleteRating(): Promise<void> {
		await this.waitForElement(this.deleteButton);
		await this.clickWithRetry(this.deleteButton);

		await this.waitForElement(this.confirmDeleteButton);
		await this.clickWithRetry(this.confirmDeleteButton);
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
