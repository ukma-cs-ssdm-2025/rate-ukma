import type { PropsWithChildren } from "react";

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FeatureFlagsProvider } from "./FeatureFlagsContext";
import { useFeatureFlag, useFeatureFlags } from "./useFeatureFlag";

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
}));

vi.mock("@/lib/auth", () => ({
	useAuth: () => authState.current,
}));

function wrapper({ children }: PropsWithChildren) {
	return <FeatureFlagsProvider>{children}</FeatureFlagsProvider>;
}

describe("feature flags", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		authState.current = { status: "unauthenticated", user: null };
		mockUseFlagsList.mockReturnValue({
			data: { flags: { fe_test_header: true } },
			isSuccess: true,
			isError: false,
			refetch: vi.fn(),
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
			refetch: vi.fn(),
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
			refetch: vi.fn(),
		});
		const { result } = renderHook(() => useFeatureFlags(), { wrapper });
		expect(result.current.isReady).toBe(true);
		expect(result.current.flags).toEqual({});
	});

	it("refetches when the auth identity changes", () => {
		const refetch = vi.fn();
		mockUseFlagsList.mockReturnValue({
			data: { flags: {} },
			isSuccess: true,
			isError: false,
			refetch,
		});
		const { rerender } = renderHook(() => useFeatureFlags(), { wrapper });
		expect(refetch).not.toHaveBeenCalled(); // skips initial mount

		authState.current = { status: "authenticated", user: { id: 1 } };
		rerender();
		expect(refetch).toHaveBeenCalledTimes(1);
	});

	it("throws when used outside the provider", () => {
		expect(() => renderHook(() => useFeatureFlag("fe_test_header"))).toThrow(
			/within a FeatureFlagsProvider/,
		);
	});
});
