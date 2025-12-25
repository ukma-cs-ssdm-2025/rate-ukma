import type { Page } from "@playwright/test";

import { TEST_CONFIG } from "./test-config";

export async function waitForPageReady(page: Page): Promise<void> {
	await page.waitForLoadState("domcontentloaded");
	await page.waitForLoadState("load", { timeout: TEST_CONFIG.timeoutMs });
}

export async function withRetry<T>(
	operation: () => Promise<T>,
	maxRetries: number = TEST_CONFIG.maxRetries,
	delay: number = TEST_CONFIG.retryDelay,
): Promise<T> {
	let lastError: Error = new Error("No attempts made");

	for (let i = 0; i <= maxRetries; i++) {
		try {
			return await operation();
		} catch (error) {
			lastError = error as Error;

			if (i < maxRetries) {
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}
	}

	throw new Error(
		`Operation failed after ${maxRetries + 1} attempts: ${lastError?.message || "Unknown error"}`,
	);
}
