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
		timeout: number = TEST_CONFIG.timeoutMs,
	): Promise<void> {
		await this.page.waitForLoadState("domcontentloaded", { timeout });
		await this.page.waitForLoadState("load", { timeout });
	}

	async waitForElement(
		locator: Locator,
		timeout: number = TEST_CONFIG.timeoutMs,
	): Promise<void> {
		await expect(locator).toBeVisible({ timeout });
	}

	async clickWithRetry(
		locator: Locator,
		maxRetries: number = TEST_CONFIG.maxRetries,
	): Promise<void> {
		let lastError: Error | undefined;
		for (let i = 0; i < maxRetries; i++) {
			try {
				await locator.click({ timeout: TEST_CONFIG.timeoutMs });
				return;
			} catch (error) {
				lastError = error as Error;
				await locator.waitFor({
					state: "visible",
					timeout: TEST_CONFIG.retryDelay,
				});
			}
		}
		throw lastError ?? new Error("Click failed after retries");
	}

	async fillWithRetry(
		locator: Locator,
		text: string,
		maxRetries: number = TEST_CONFIG.maxRetries,
	): Promise<void> {
		let lastError: Error | undefined;
		for (let i = 0; i < maxRetries; i++) {
			try {
				await locator.fill(text, { timeout: TEST_CONFIG.timeoutMs });
				return;
			} catch (error) {
				lastError = error as Error;
				await locator.waitFor({
					state: "visible",
					timeout: TEST_CONFIG.retryDelay,
				});
			}
		}
		throw lastError ?? new Error("Fill failed after retries");
	}

	async getTextContent(locator: Locator): Promise<string> {
		await this.waitForElement(locator);
		const text = await locator.textContent();
		if (!text) {
			throw new Error(`No text content found for locator: ${locator}`);
		}
		return text;
	}
}
