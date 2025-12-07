import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

export class BasePage {
	protected page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	/**
	 * Wait for page to be fully loaded and ready for interactions
	 */
	async waitForPageLoad(): Promise<void> {
		await this.page.waitForLoadState("domcontentloaded");
		await this.page.waitForLoadState("networkidle");
	}

	async waitForElement(locator: Locator, timeout = 10000): Promise<void> {
		await expect(locator).toBeVisible({ timeout });
	}

	async clickWithRetry(locator: Locator, maxRetries = 3): Promise<void> {
		for (let i = 0; i < maxRetries; i++) {
			try {
				await locator.click();
				return;
			} catch (error) {
				if (i === maxRetries - 1) throw error;
				await this.page.waitForTimeout(500);
			}
		}
	}

	async fillWithRetry(
		locator: Locator,
		text: string,
		maxRetries = 3,
	): Promise<void> {
		for (let i = 0; i < maxRetries; i++) {
			try {
				await locator.fill(text);
				return;
			} catch (error) {
				if (i === maxRetries - 1) throw error;
				await this.page.waitForTimeout(500);
			}
		}
	}

	async getTextContent(locator: Locator): Promise<string> {
		await this.waitForElement(locator);
		const text = await locator.textContent();
		if (!text) {
			throw new Error(`No text content found for locator: ${locator}`);
		}
		return text;
	}

	// (e.g., "Складність: 3/5" -> 3)
	extractRatingValue(text: string, label: string): number {
		const match = text.replace(`${label}: `, "").split("/")[0];
		const value = Number(match);
		if (Number.isNaN(value)) {
			throw new Error(`Could not extract numeric value from: ${text}`);
		}
		return value;
	}
}
