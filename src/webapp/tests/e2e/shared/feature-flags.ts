import type { Page } from "@playwright/test";

export async function setFeatureFlagOverride(
	page: Page,
	name: string,
	value: boolean,
): Promise<void> {
	await page.addInitScript(
		({ name, value }) => {
			const KEY = "ff:overrides";
			let current: Record<string, boolean> = {};
			try {
				const parsed: unknown = JSON.parse(
					window.localStorage.getItem(KEY) ?? "{}",
				);
				if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
					current = parsed as Record<string, boolean>;
				}
			} catch {
				current = {};
			}
			current[name] = value;
			window.localStorage.setItem(KEY, JSON.stringify(current));
		},
		{ name, value },
	);
}
