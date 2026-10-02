import { useFeatureFlagState } from "@/lib/feature-flags";

/**
 * The rate-all flow and every way into it: `/rate`, the header count, the
 * feed tile, the course-page card and the «Оцінити решту» offers. Off for
 * everyone until the flag is turned on.
 */
export function useRateFlow(): { enabled: boolean; isReady: boolean } {
	return useFeatureFlagState("fe_rate_flow");
}
