import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { TEST_CONFIG } from "./test-config";

export async function waitForPageReady(page: Page): Promise<void> {
	await page.waitForLoadState("domcontentloaded");
	await page.waitForLoadState("networkidle", {
		timeout: TEST_CONFIG.networkIdleTimeout,
	});

	await page.waitForTimeout(500);
}

export async function withRetry<T>(
	operation: () => Promise<T>,
	maxRetries = TEST_CONFIG.maxRetries,
	delay = TEST_CONFIG.retryDelay,
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

export async function waitForElementWithContext(
	page: Page,
	locator: string,
	context: string,
	timeout = TEST_CONFIG.elementTimeout,
): Promise<void> {
	try {
		await expect(page.locator(locator)).toBeVisible({ timeout });
	} catch (error) {
		throw new Error(`Element not found in ${context}: ${locator}. ${error}`);
	}
}

export async function extractTextSafely(
	page: Page,
	locator: string,
	context: string,
): Promise<string> {
	try {
		const element = page.locator(locator);
		await expect(element).toBeVisible({ timeout: TEST_CONFIG.elementTimeout });
		const text = await element.textContent();

		if (!text) {
			throw new Error(`No text content found for ${context}`);
		}

		return text.trim();
	} catch (error) {
		throw new Error(`Failed to extract text for ${context}: ${error}`);
	}
}

export function extractRatingFromText(text: string, label: string): number {
	const regex = new RegExp(`${label}:\\s*(\\d+)/\\d+`);
	const match = text.match(regex);

	if (!match) {
		throw new Error(
			`Could not extract rating from text: "${text}" using label: "${label}"`,
		);
	}

	const value = Number(match[1]);
	if (Number.isNaN(value) || value < 1 || value > 5) {
		throw new Error(`Invalid rating value extracted: ${value}`);
	}

	return value;
}

export function verifyRatingChange(
	initialValue: number,
	newValue: number,
	expectedIncrement: number,
	ratingType: string,
): void {
	if (newValue !== initialValue + expectedIncrement) {
		throw new Error(
			`${ratingType} rating not changed correctly. Initial: ${initialValue}, ` +
				`New: ${newValue}, Expected: ${initialValue + expectedIncrement}`,
		);
	}
}
