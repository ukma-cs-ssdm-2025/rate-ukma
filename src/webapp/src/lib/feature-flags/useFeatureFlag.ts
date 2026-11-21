import { useContext } from "react";

import type { PublicFeatureFlags } from "../api/generated";
import { FeatureFlagsContext } from "./FeatureFlagsContext";

export type FeatureFlagName = keyof PublicFeatureFlags;

export function useFeatureFlags() {
	const context = useContext(FeatureFlagsContext);
	if (!context) {
		throw new Error(
			"useFeatureFlags must be used within a FeatureFlagsProvider",
		);
	}
	return context;
}

export function useFeatureFlag(name: FeatureFlagName): boolean {
	return useFeatureFlags().flags[name] ?? false;
}

export function useFeatureFlagState(name: FeatureFlagName) {
	const { flags, isReady } = useFeatureFlags();
	return { enabled: flags[name] ?? false, isReady };
}
