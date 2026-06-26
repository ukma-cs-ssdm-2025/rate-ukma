/**
 * Client-side feature-flag overrides.
 *
 * Waffle evaluates flags per-user on the server, so there is no way to flip a
 * flag from the browser for testing. These overrides layer on top of the
 * server response (see `FeatureFlagsProvider`) so QA / Playwright can force a
 * flag on or off without touching the backend.
 *
 * Enabled in EVERY environment (including live): the E2E suite runs against
 * live too and relies on flipping flags, and the override is an obscure,
 * console-only affordance that only changes client-side display gating (the
 * write path is validated server-side regardless). Not a security boundary.
 */

const STORAGE_KEY = "ff:overrides";
const CHANGE_EVENT = "ff:overrides-changed";

export const featureFlagOverridesEnabled = true;

export function readFeatureFlagOverrides(): Record<string, boolean> {
	if (!featureFlagOverridesEnabled || typeof localStorage === "undefined") {
		return {};
	}
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return {};
		const parsed: unknown = JSON.parse(raw);
		if (parsed && typeof parsed === "object") {
			return Object.fromEntries(
				Object.entries(parsed as Record<string, unknown>)
					.filter(([, v]) => typeof v === "boolean")
					.map(([k, v]) => [k, v as boolean]),
			);
		}
	} catch {
		// corrupt value — treat as no overrides
	}
	return {};
}

function writeOverrides(next: Record<string, boolean>): void {
	if (!featureFlagOverridesEnabled || typeof localStorage === "undefined") {
		return;
	}
	localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
	globalThis.dispatchEvent(new Event(CHANGE_EVENT));
}

export function setFeatureFlagOverride(name: string, value: boolean): void {
	writeOverrides({ ...readFeatureFlagOverrides(), [name]: value });
}

export function clearFeatureFlagOverride(name: string): void {
	const next = readFeatureFlagOverrides();
	delete next[name];
	writeOverrides(next);
}

export function clearFeatureFlagOverrides(): void {
	writeOverrides({});
}

export const FEATURE_FLAG_OVERRIDES_EVENT = CHANGE_EVENT;
export const FEATURE_FLAG_OVERRIDES_STORAGE_KEY = STORAGE_KEY;

/**
 * Expose `window.featureFlags` helpers in non-live environments so a flag can
 * be flipped straight from the browser console:
 *   featureFlags.set("fe_instructor_multiselect", true)
 *   featureFlags.clear("fe_instructor_multiselect")
 *   featureFlags.list()
 */
export function installFeatureFlagConsoleHelpers(): void {
	if (!featureFlagOverridesEnabled || typeof window === "undefined") {
		return;
	}
	(window as unknown as { featureFlags?: unknown }).featureFlags = {
		set: setFeatureFlagOverride,
		clear: clearFeatureFlagOverride,
		clearAll: clearFeatureFlagOverrides,
		list: readFeatureFlagOverrides,
	};
}
