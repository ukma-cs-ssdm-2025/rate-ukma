import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { getStudentsMePlanRetrieveQueryKey } from "@/lib/api/generated";
import type { PersonalPlan } from "@/lib/api/generated";
import { renderHookWithProviders } from "@/test-utils/render";
import { usePlanActions } from "./usePlanActions";
import type { PlanTarget } from "./usePlanActions";

const { fetcherMock } = vi.hoisted(() => ({ fetcherMock: vi.fn() }));

vi.mock("@/lib/api/apiClient", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/api/apiClient")>()),
	authorizedFetcher: fetcherMock,
}));

function planAfterSave(saveNumber: number): PersonalPlan {
	return {
		enrollment_year_start: 2025,
		current_year_start: 2025 + saveNumber,
		plan_years: [],
	};
}

function deferred<T>() {
	let resolve: (value: T) => void = () => undefined;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

describe("usePlanActions", () => {
	it("keeps the newest plan when an earlier save answers last", async () => {
		const first = deferred<PersonalPlan>();
		const second = deferred<PersonalPlan>();
		fetcherMock
			.mockReturnValueOnce(first.promise)
			.mockReturnValueOnce(second.promise);
		const { result, queryClient } = renderHookWithProviders(() =>
			usePlanActions(),
		);
		const target: PlanTarget = { study_year: 2, semester_term: "FALL" };

		act(() => {
			result.current.add(target, "architecture", "MAIN");
			result.current.add(target, "cloud", "MAIN");
		});
		await act(async () => {
			second.resolve(planAfterSave(2));
			await second.promise;
		});
		await act(async () => {
			first.resolve(planAfterSave(1));
			await first.promise;
		});

		await waitFor(() => expect(result.current.isSaving).toBe(false));
		expect(
			queryClient.getQueryData(getStudentsMePlanRetrieveQueryKey()),
		).toEqual(planAfterSave(2));
	});
});
