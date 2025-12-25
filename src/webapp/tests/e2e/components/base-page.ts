import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { TEST_CONFIG } from "./test-config";

export class BasePage {
	protected page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	/**
	 * Wait for page to be fully loaded and ready for interactions
	 */
	async waitForPageLoad(
		timeout: number = TEST_CONFIG.pageLoadTimeout,
	): Promise<void> {
		await this.page.waitForLoadState("domcontentloaded", { timeout });
		await this.page.waitForLoadState("networkidle", {
			timeout: Math.max(timeout, TEST_CONFIG.networkIdleTimeout),
		});
	}

	async waitForElement(
		locator: Locator,
		timeout: number = TEST_CONFIG.elementTimeout,
	): Promise<void> {
		await expect(locator).toBeVisible({ timeout });
	}

	async clickWithRetry(
		locator: Locator,
		maxRetries: number = TEST_CONFIG.maxRetries,
	): Promise<void> {
		for (let i = 0; i < maxRetries; i++) {
			try {
				await locator.click();
				return;
			} catch (error) {
				if (i === maxRetries - 1) throw error;
				await this.page.waitForTimeout(TEST_CONFIG.retryDelay);
			}
		}
	}

	async fillWithRetry(
		locator: Locator,
		text: string,
		maxRetries: number = TEST_CONFIG.maxRetries,
	): Promise<void> {
		for (let i = 0; i < maxRetries; i++) {
			try {
				await locator.fill(text);
				return;
			} catch (error) {
				if (i === maxRetries - 1) throw error;
				await this.page.waitForTimeout(TEST_CONFIG.retryDelay);
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
