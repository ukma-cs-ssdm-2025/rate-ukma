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

	private readonly page: Page;
	private readonly instructorTrigger: Locator;
	private readonly instructorInput: Locator;

	constructor(page: Page) {
		this.page = page;
		this.modal = page.getByTestId(testIds.rating.modal);
		this.difficultyStars = page.getByTestId(testIds.rating.difficultySlider);
		this.usefulnessStars = page.getByTestId(testIds.rating.usefulnessSlider);
		this.commentTextarea = page.getByTestId(testIds.rating.commentTextarea);
		this.instructorTrigger = page.getByTestId(
			testIds.rating.instructorMultiSelect,
		);
		this.instructorInput = page.getByTestId(testIds.rating.instructorInput);

		this.saveButton = page.getByTestId(testIds.rating.submitButton);
	}

	/** Legacy free-text instructor input (shown when the multi-select flag is off). */
	async fillInstructorText(text: string): Promise<void> {
		await expect(this.instructorInput).toBeVisible();
		await this.instructorInput.fill(text);
	}

	async getInstructorTextValue(): Promise<string> {
		return this.instructorInput.inputValue();
	}

	instructorMultiSelectLocator(): Locator {
		return this.instructorTrigger;
	}

	instructorTextInputLocator(): Locator {
		return this.instructorInput;
	}

	async openInstructorPicker(): Promise<void> {
		await expect(this.instructorTrigger).toBeVisible();
		const list = this.page.getByTestId(
			`${testIds.rating.instructorMultiSelect}-list`,
		);
		// Click the chevron, not the trigger itself: once a chip is selected the
		// trigger's centre lands on that chip's remove button, which removes the
		// chip and stops the click from reaching the popover.
		const toggle = this.page.getByTestId(
			`${testIds.rating.instructorMultiSelect}-toggle`,
		);
		// The picker is a Radix Popover rendered inside the rating Dialog; the
		// open click can race with the dialog's focus handling, so retry the
		// click until the list actually shows.
		await expect(async () => {
			if (!(await list.isVisible())) {
				await toggle.click();
			}
			await expect(list).toBeVisible({ timeout: 2_000 });
		}).toPass({ timeout: 20_000 });
	}

	async cancel(): Promise<void> {
		await this.page.getByTestId(testIds.rating.cancelButton).click();
		await this.waitForHidden();
	}

	async searchInstructor(query: string): Promise<void> {
		const list = this.page.getByTestId(
			`${testIds.rating.instructorMultiSelect}-list`,
		);
		await expect(list).toBeVisible();
		await this.page
			.locator(
				`[data-testid='${testIds.rating.instructorMultiSelect}-content'] [cmdk-input]`,
			)
			.fill(query);
	}

	async clearInstructorSearch(): Promise<void> {
		await this.page
			.locator(
				`[data-testid='${testIds.rating.instructorMultiSelect}-content'] [cmdk-input]`,
			)
			.fill("");
	}

	/** Names currently offered by the picker, in listed order. */
	async getListedInstructorNames(limit = 5): Promise<string[]> {
		const list = this.page.getByTestId(
			`${testIds.rating.instructorMultiSelect}-list`,
		);
		await expect(list).toBeVisible();
		const options = list.getByRole("option");
		await expect(options.first()).toBeVisible();
		const count = Math.min(await options.count(), limit);
		const names: string[] = [];
		for (let i = 0; i < count; i++) {
			names.push((await options.nth(i).innerText()).trim());
		}
		return names;
	}

	/**
	 * Search for a name, then pick the row that matches it exactly, so the
	 * choice never depends on directory ordering or on a partial-name collision.
	 */
	async pickInstructorByText(text: string): Promise<void> {
		const list = this.page.getByTestId(
			`${testIds.rating.instructorMultiSelect}-list`,
		);
		await this.searchInstructor(text);
		const option = list.getByRole("option", { name: text, exact: true });
		await expect(option).toBeVisible();
		await option.click();
	}

	async closeInstructorPicker(): Promise<void> {
		const list = this.page.getByTestId(
			`${testIds.rating.instructorMultiSelect}-list`,
		);
		await this.page.keyboard.press("Escape");
		await expect(list).toBeHidden();
	}

	private get instructorChips(): Locator {
		return this.instructorTrigger.locator("span[class*='bg-secondary']");
	}

	async getSelectedInstructorCount(): Promise<number> {
		return this.instructorChips.count();
	}

	async getSelectedInstructorNames(): Promise<string[]> {
		const count = await this.instructorChips.count();
		const names: string[] = [];
		for (let i = 0; i < count; i++) {
			names.push((await this.instructorChips.nth(i).innerText()).trim());
		}
		return names;
	}

	/** Remove the chip at `index` by clicking its × button. */
	async removeInstructorChipByIndex(index: number): Promise<void> {
		await this.instructorChips.nth(index).locator("button").click();
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

		if (!Number.isInteger(targetValue) || targetValue < 1 || targetValue > 5) {
			throw new RangeError(
				`Star value must be an integer between 1 and 5, got: ${targetValue}`,
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
