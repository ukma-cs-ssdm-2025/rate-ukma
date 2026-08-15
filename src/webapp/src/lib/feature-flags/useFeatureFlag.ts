import { useContext } from "react";

import { FeatureFlagsContext } from "./FeatureFlagsContext";

export function useFeatureFlags() {
	const context = useContext(FeatureFlagsContext);
	if (!context) {
		throw new Error(
			"useFeatureFlags must be used within a FeatureFlagsProvider",
		);
	}
	return context;
}

export function useFeatureFlag(name: string): boolean {
	return useFeatureFlags().flags[name] ?? false;
}

/**
 * Flag value plus whether it has resolved yet, for UI that must not flash the
 * wrong variant. `useFeatureFlag` alone reports an unresolved flag as `false`,
 * which is indistinguishable from "off".
 */
export function useFeatureFlagState(name: string): {
	enabled: boolean;
	isReady: boolean;
} {
	const { flags, isReady } = useFeatureFlags();
	return { enabled: flags[name] ?? false, isReady };
}
