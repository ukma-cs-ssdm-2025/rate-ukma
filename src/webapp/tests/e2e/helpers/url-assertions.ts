import { expect, type Page } from "@playwright/test";

export function getUrlSearchParams(page: Page): URLSearchParams {
	return new URL(page.url()).searchParams;
}

export function getSearchParam(page: Page, key: string): string {
	return getUrlSearchParams(page).get(key) ?? "";
}

export function getAllSearchParams(page: Page): Record<string, string> {
	const params: Record<string, string> = {};
	getUrlSearchParams(page).forEach((value, key) => {
		params[key] = value;
	});
	return params;
}

export async function expectSearchParam(
	page: Page,
	key: string,
	expected: string,
	{ timeout = 10_000 }: { timeout?: number } = {},
): Promise<void> {
	await expect
		.poll(() => getSearchParam(page, key), { timeout })
		.toBe(expected);
}

export async function expectSearchParamNotEmpty(
	page: Page,
	key: string,
	{ timeout = 10_000 }: { timeout?: number } = {},
): Promise<void> {
	await expect.poll(() => getSearchParam(page, key), { timeout }).not.toBe("");
}
