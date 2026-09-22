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

import { z } from "zod";

import { hasLocalStorage, hasWindow } from "@/lib/environment";

const STORAGE_KEY = "ff:overrides";
const CHANGE_EVENT = "ff:overrides-changed";

/** Any JSON object; entries are filtered to booleans below. */
const overridesRecordSchema = z.record(z.string(), z.unknown());

export const featureFlagOverridesEnabled = true;

export function readFeatureFlagOverrides() {
	if (!featureFlagOverridesEnabled || !hasLocalStorage()) {
		return {};
	}
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return {};
		const parsed = overridesRecordSchema.safeParse(JSON.parse(raw));
		if (!parsed.success) return {};
		const overrides: Record<string, boolean> = {};
		for (const [name, value] of Object.entries(parsed.data)) {
			// Salvage the valid entries even if one stored value is corrupted.
			if (value === true || value === false) {
				overrides[name] = value;
			}
		}
		return overrides;
	} catch {
		// corrupt value — treat as no overrides
	}
	return {};
}

function writeOverrides(next: Record<string, boolean>): void {
	if (!featureFlagOverridesEnabled || !hasLocalStorage()) {
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

declare global {
	interface Window {
		featureFlags?: unknown;
	}
}

/**
 * Expose `window.featureFlags` helpers in non-live environments so a flag can
 * be flipped straight from the browser console:
 *   featureFlags.set("fe_instructor_multiselect", true)
 *   featureFlags.clear("fe_instructor_multiselect")
 *   featureFlags.list()
 */
export function installFeatureFlagConsoleHelpers(): void {
	if (!featureFlagOverridesEnabled || !hasWindow()) {
		return;
	}
	window.featureFlags = {
		set: setFeatureFlagOverride,
		clear: clearFeatureFlagOverride,
		clearAll: clearFeatureFlagOverrides,
		list: readFeatureFlagOverrides,
	};
}
