import type { PropsWithChildren } from "react";

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as auth from "@/lib/auth";
import type { AuthUser } from "@/lib/auth";
import type { AuthContextValue } from "@/lib/auth/AuthContext";
import * as generated from "../api/generated";

import { FeatureFlagsProvider } from "./FeatureFlagsContext";
import {
	type FeatureFlagName,
	useFeatureFlag,
	useFeatureFlags,
	useFeatureFlagState,
} from "./useFeatureFlag";

const FLAGS_QUERY_KEY = ["/api/v1/flags/"];
// SAFETY: fixture names bypass the live allowlist; the stubbed flags map is controlled by the test.
const FE_EXAMPLE = "fe_example" as FeatureFlagName;
// SAFETY: fixture names bypass the live allowlist; the stubbed flags map is controlled by the test.
const FE_MISSING = "fe_missing" as FeatureFlagName;
let mockUseFlagsList: ReturnType<typeof vi.spyOn>;
let currentAuth: AuthContextValue;

interface FlagsQueryStub {
	data: { flags: Record<string, boolean> } | undefined;
	isSuccess: boolean;
	isError: boolean;
}

function flagsStub(over: FlagsQueryStub) {
	return over;
}

function createAuthState(
	status: AuthContextValue["status"],
	user: AuthUser | null,
): AuthContextValue {
	return {
		status,
		user,
		sessionExpired: false,
		isStudent: status === "authenticated",
		loginWithMicrosoft: vi.fn(),
		loginWithDjango: vi.fn(() => Promise.resolve()),
		logout: vi.fn(() => Promise.resolve()),
		checkAuth: vi.fn(),
	};
}

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
		currentAuth = createAuthState("unauthenticated", null);
		mockUseFlagsList = vi.spyOn(generated, "useFlagsList");
		mockUseFlagsList.mockReturnValue(
			// SAFETY: FeatureFlagsProvider only reads data/isSuccess/isError.
			flagsStub({
				data: { flags: { [FE_EXAMPLE]: true } },
				isSuccess: true,
				isError: false,
			}) as ReturnType<typeof generated.useFlagsList>,
		);
		vi.spyOn(auth, "useAuth").mockImplementation(() => currentAuth);
	});

	it("returns true for an enabled flag", () => {
		const { result } = renderHook(() => useFeatureFlag(FE_EXAMPLE), {
			wrapper,
		});
		expect(result.current).toBe(true);
	});

	it("returns false for an unknown flag", () => {
		const { result } = renderHook(() => useFeatureFlag(FE_MISSING), {
			wrapper,
		});
		expect(result.current).toBe(false);
	});

	it("separates an unresolved flag from an off one", () => {
		mockUseFlagsList.mockReturnValue(
			// SAFETY: FeatureFlagsProvider only reads data/isSuccess/isError.
			flagsStub({
				data: undefined,
				isSuccess: false,
				isError: false,
			}) as ReturnType<typeof generated.useFlagsList>,
		);
		const { result } = renderHook(() => useFeatureFlagState(FE_EXAMPLE), {
			wrapper,
		});
		expect(result.current).toEqual({ enabled: false, isReady: false });
	});

	it("is not ready and exposes no flags before the query resolves", () => {
		mockUseFlagsList.mockReturnValue(
			// SAFETY: FeatureFlagsProvider only reads data/isSuccess/isError.
			flagsStub({
				data: undefined,
				isSuccess: false,
				isError: false,
			}) as ReturnType<typeof generated.useFlagsList>,
		);
		const { result } = renderHook(() => useFeatureFlags(), { wrapper });
		expect(result.current.isReady).toBe(false);
		expect(result.current.flags).toEqual({});
	});

	it("is ready with default-off flags after a failed fetch", () => {
		mockUseFlagsList.mockReturnValue(
			// SAFETY: FeatureFlagsProvider only reads data/isSuccess/isError.
			flagsStub({
				data: undefined,
				isSuccess: false,
				isError: true,
			}) as ReturnType<typeof generated.useFlagsList>,
		);
		const { result } = renderHook(() => useFeatureFlags(), { wrapper });
		expect(result.current.isReady).toBe(true);
		expect(result.current.flags).toEqual({});
	});

	it("keys the flags query by auth identity", () => {
		const { rerender } = renderHook(() => useFeatureFlags(), { wrapper });
		const anonKey = lastQueryKey();
		expect(anonKey).toEqual([...FLAGS_QUERY_KEY, "unauthenticated", null]);

		currentAuth = createAuthState("authenticated", { id: 1 });
		rerender();
		expect(lastQueryKey()).toEqual([...FLAGS_QUERY_KEY, "authenticated", 1]);
	});

	it("throws when used outside the provider", () => {
		expect(() => renderHook(() => useFeatureFlag(FE_EXAMPLE))).toThrow(
			/within a FeatureFlagsProvider/,
		);
	});
});
