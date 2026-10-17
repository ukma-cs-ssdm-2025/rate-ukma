import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Decision } from "../api/schemas";
import {
	useDecide,
	useDecisions,
	useReviewCases,
	useUkmaDataOverview,
} from "./useUkmaData";

const fakeClient = vi.hoisted(() => ({
	overview: vi.fn(),
	reviewCases: vi.fn(),
	reviewCase: vi.fn(),
	decisions: vi.fn(),
	decide: vi.fn(),
}));

vi.mock("../api/client", () => ({ ukmaDataClient: fakeClient }));

const DECISION = { id: "dec_1", kind: "keep_apart" } as Decision;

function createWrapper() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	fakeClient.overview.mockResolvedValue({ openCases: {} });
	fakeClient.reviewCases.mockResolvedValue([]);
	fakeClient.decisions.mockResolvedValue([]);
	fakeClient.decide.mockResolvedValue(DECISION);
});

describe("useReviewCases", () => {
	it("asks the client for each filter separately", async () => {
		const { result, rerender } = renderHook(
			({ status }: { status: "open" | "decided" }) =>
				useReviewCases({ status }),
			{ wrapper: createWrapper(), initialProps: { status: "open" } },
		);
		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		rerender({ status: "decided" });
		await waitFor(() =>
			expect(fakeClient.reviewCases).toHaveBeenCalledTimes(2),
		);

		expect(fakeClient.reviewCases.mock.calls).toEqual([
			[{ status: "open" }],
			[{ status: "decided" }],
		]);
	});

	it("surfaces a client error", async () => {
		fakeClient.reviewCases.mockRejectedValue(new Error("bad response"));

		const { result } = renderHook(() => useReviewCases({}), {
			wrapper: createWrapper(),
		});

		await waitFor(() => expect(result.current.isError).toBe(true));
		expect(result.current.error?.message).toBe("bad response");
	});
});

describe("useDecide", () => {
	it("refetches the overview and the trail after a decision", async () => {
		const { result } = renderHook(
			() => ({
				overview: useUkmaDataOverview(),
				trail: useDecisions({ reviewCaseId: "rev_1" }),
				decide: useDecide(),
			}),
			{ wrapper: createWrapper() },
		);
		await waitFor(() => expect(result.current.trail.isSuccess).toBe(true));
		await waitFor(() => expect(result.current.overview.isSuccess).toBe(true));

		await act(() =>
			result.current.decide.mutateAsync({
				kind: "keep_apart",
				reviewCaseId: "rev_1",
			}),
		);

		expect(fakeClient.decide).toHaveBeenCalledWith({
			kind: "keep_apart",
			reviewCaseId: "rev_1",
		});
		await waitFor(() => expect(fakeClient.overview).toHaveBeenCalledTimes(2));
		expect(fakeClient.decisions).toHaveBeenCalledTimes(2);
	});
});
