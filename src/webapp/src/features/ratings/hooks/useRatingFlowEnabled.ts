import { useFeatureFlagState } from "@/lib/feature-flags";

export function useRatingFlowEnabled(): boolean {
	const { enabled, isReady } = useFeatureFlagState("fe_rate_flow");
	return isReady && enabled;
}
