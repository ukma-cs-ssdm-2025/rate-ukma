import type { PropsWithChildren } from "react";

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FeatureFlagsProvider } from "./FeatureFlagsContext";
import { useFeatureFlag, useFeatureFlags } from "./useFeatureFlag";

const mockUseFlagsList = vi.fn();

vi.mock("../api/generated", () => ({
	useFlagsList: (...args: unknown[]) => mockUseFlagsList(...args),
}));

function wrapper({ children }: PropsWithChildren) {
	return <FeatureFlagsProvider>{children}</FeatureFlagsProvider>;
}

describe("feature flags", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockUseFlagsList.mockReturnValue({
			data: { flags: { fe_test_header: true } },
			isSuccess: true,
		});
	});

	it("returns true for an enabled flag", () => {
		const { result } = renderHook(() => useFeatureFlag("fe_test_header"), {
			wrapper,
		});
		expect(result.current).toBe(true);
	});

	it("returns false for an unknown flag", () => {
		const { result } = renderHook(() => useFeatureFlag("fe_missing"), {
			wrapper,
		});
		expect(result.current).toBe(false);
	});

	it("is not ready and exposes no flags before the query resolves", () => {
		mockUseFlagsList.mockReturnValue({ data: undefined, isSuccess: false });
		const { result } = renderHook(() => useFeatureFlags(), { wrapper });
		expect(result.current.isReady).toBe(false);
		expect(result.current.flags).toEqual({});
	});

	it("throws when used outside the provider", () => {
		expect(() => renderHook(() => useFeatureFlag("fe_test_header"))).toThrow(
			/within a FeatureFlagsProvider/,
		);
	});
});
