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
