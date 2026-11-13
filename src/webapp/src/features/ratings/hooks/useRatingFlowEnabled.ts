import { useFeatureFlagState } from "@/lib/feature-flags";

/** True only once flags have resolved and `fe_rate_flow` is on. */
export function useRatingFlowEnabled(): boolean {
	const { enabled, isReady } = useFeatureFlagState("fe_rate_flow");
	return isReady && enabled;
}
