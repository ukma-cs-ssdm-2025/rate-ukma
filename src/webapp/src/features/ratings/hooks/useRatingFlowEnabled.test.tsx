import { describe, expect, it } from "vitest";

import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";

import { FeatureFlagsContext } from "@/lib/feature-flags/FeatureFlagsContext";
import { useRatingFlowEnabled } from "./useRatingFlowEnabled";

function enabledFor(flags: Record<string, boolean>, isReady: boolean) {
	const wrapper = ({ children }: { children: ReactNode }) => (
		<FeatureFlagsContext.Provider value={{ flags, isReady }}>
			{children}
		</FeatureFlagsContext.Provider>
	);
	return renderHook(() => useRatingFlowEnabled(), { wrapper }).result.current;
}

describe("useRatingFlowEnabled", () => {
	it("is on only when the flag is on and flags have resolved", () => {
		expect(enabledFor({ fe_rate_flow: true }, true)).toBe(true);
	});

	it.each([
		["flag off", { fe_rate_flow: false }, true],
		["flag missing", {}, true],
		["flags unresolved, even with the flag on", { fe_rate_flow: true }, false],
	])("is off when %s", (_name, flags, isReady) => {
		expect(enabledFor(flags, isReady)).toBe(false);
	});
});
