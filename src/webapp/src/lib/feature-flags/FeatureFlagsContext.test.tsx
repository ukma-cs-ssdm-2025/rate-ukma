import type { PropsWithChildren } from "react";

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FeatureFlagsProvider } from "./FeatureFlagsContext";
import { useFeatureFlag, useFeatureFlags } from "./useFeatureFlag";

const FLAGS_QUERY_KEY = ["/api/v1/flags/"];
const mockUseFlagsList = vi.fn();

const { authState } = vi.hoisted(() => ({
	authState: {
		current: { status: "unauthenticated", user: null } as {
			status: string;
			user: { id: number } | null;
		},
	},
}));

vi.mock("../api/generated", () => ({
	useFlagsList: (...args: unknown[]) => mockUseFlagsList(...args),
	getFlagsListQueryKey: () => [...FLAGS_QUERY_KEY],
}));

vi.mock("@/lib/auth", () => ({
	useAuth: () => authState.current,
}));

function wrapper({ children }: PropsWithChildren) {
	return <FeatureFlagsProvider>{children}</FeatureFlagsProvider>;
}

function lastQueryKey() {
	const lastCall = mockUseFlagsList.mock.calls.at(-1)?.[0];
	return lastCall?.query?.queryKey;
}

describe("feature flags", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear(); // drop any ff:overrides leaked from other tests
		authState.current = { status: "unauthenticated", user: null };
		mockUseFlagsList.mockReturnValue({
			data: { flags: { fe_test_header: true } },
			isSuccess: true,
			isError: false,
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
		mockUseFlagsList.mockReturnValue({
			data: undefined,
			isSuccess: false,
			isError: false,
		});
		const { result } = renderHook(() => useFeatureFlags(), { wrapper });
		expect(result.current.isReady).toBe(false);
		expect(result.current.flags).toEqual({});
	});

	it("is ready with default-off flags after a failed fetch", () => {
		mockUseFlagsList.mockReturnValue({
			data: undefined,
			isSuccess: false,
			isError: true,
		});
		const { result } = renderHook(() => useFeatureFlags(), { wrapper });
		expect(result.current.isReady).toBe(true);
		expect(result.current.flags).toEqual({});
	});

	it("keys the flags query by auth identity", () => {
		const { rerender } = renderHook(() => useFeatureFlags(), { wrapper });
		const anonKey = lastQueryKey();
		expect(anonKey).toEqual([...FLAGS_QUERY_KEY, "unauthenticated", null]);

		authState.current = { status: "authenticated", user: { id: 1 } };
		rerender();
		expect(lastQueryKey()).toEqual([...FLAGS_QUERY_KEY, "authenticated", 1]);
	});

	it("throws when used outside the provider", () => {
		expect(() => renderHook(() => useFeatureFlag("fe_test_header"))).toThrow(
			/within a FeatureFlagsProvider/,
		);
	});
});
