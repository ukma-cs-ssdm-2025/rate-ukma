const STORAGE_KEY = "ff:overrides";
const CHANGE_EVENT = "ff:overrides-changed";

export const featureFlagOverridesEnabled = true;

export function readFeatureFlagOverrides(): Record<string, boolean> {
	if (!featureFlagOverridesEnabled || typeof localStorage === "undefined") {
		return {};
	}
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return {};
		}
		const parsed: unknown = JSON.parse(raw);
		if (parsed && typeof parsed === "object") {
			return Object.fromEntries(
				Object.entries(parsed).filter(
					(entry): entry is [string, boolean] => typeof entry[1] === "boolean",
				),
			);
		}
	} catch {
		return {};
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

export function installFeatureFlagConsoleHelpers(): void {
	if (!featureFlagOverridesEnabled || typeof window === "undefined") {
		return;
	}
	Object.assign(window, {
		featureFlags: {
			set: setFeatureFlagOverride,
			clear: clearFeatureFlagOverride,
			clearAll: clearFeatureFlagOverrides,
			list: readFeatureFlagOverrides,
		},
	});
}
