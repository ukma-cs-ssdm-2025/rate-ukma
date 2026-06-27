import type { Page } from "@playwright/test";

/**
 * Force a feature flag on/off in the browser for the lifetime of the test.
 *
 * Mirrors `src/lib/feature-flags/overrides.ts`: seeds the `ff:overrides`
 * localStorage entry that `FeatureFlagsProvider` merges over the server
 * response. Must be called BEFORE `page.goto(...)` — `addInitScript` runs on
 * every navigation, before app code. Only effective in non-live environments.
 */
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
