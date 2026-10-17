import { describe, expect, it, vi } from "vitest";

import { useStudentsMeRatingSuggestionsList } from "@/lib/api/generated";
import { render, screen } from "@/test-utils/render";
import { RatingSuggestionPrompt } from "./RatingSuggestionPrompt";

vi.mock("@/lib/api/generated", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/api/generated")>();
	return { ...actual, useStudentsMeRatingSuggestionsList: vi.fn() };
});

vi.mock("@/lib/auth", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth")>();
	return {
		...actual,
		useAuth: () => ({ ...actual.useAuth(), isStudent: true }),
	};
});

vi.mock("./RatingModal", () => ({ RatingModal: () => null }));

const SUGGESTION = {
	course_id: "c-db",
	course_offering_id: "offering-c-db",
	course_title: "Бази даних",
	semester: { year: 2026, season: "SPRING" },
	ratings_count: 0,
};

function renderPrompt(flags: Record<string, boolean>, flagsReady = true) {
	vi.mocked(useStudentsMeRatingSuggestionsList).mockClear();
	// Echo the caller's `enabled` the way react-query does: a disabled query has no data.
	vi.mocked(useStudentsMeRatingSuggestionsList).mockImplementation(((
		_params: unknown,
		options?: {
			query?: { enabled?: boolean };
		},
	) => ({
		data: options?.query?.enabled === false ? undefined : [SUGGESTION],
	})) as unknown as typeof useStudentsMeRatingSuggestionsList);
	render(<RatingSuggestionPrompt />, { flags, flagsReady });
}

describe("RatingSuggestionPrompt behind fe_rate_flow", () => {
	it("shows suggestions when the flag is on", () => {
		renderPrompt({ fe_rate_flow: true });

		expect(
			screen.queryByRole("region", { name: "Що оцінити далі" }),
		).not.toBeNull();
	});

	it.each([
		["off", { fe_rate_flow: false }, true],
		["unresolved", { fe_rate_flow: true }, false],
	])(
		"renders nothing and requests nothing when the flag is %s",
		(_name, flags, ready) => {
			renderPrompt(flags, ready);

			expect(
				screen.queryByRole("region", { name: "Що оцінити далі" }),
			).toBeNull();
			const calls = vi.mocked(useStudentsMeRatingSuggestionsList).mock.calls;
			expect(calls.length).toBeGreaterThan(0);
			for (const [, options] of calls) {
				expect(options?.query?.enabled).toBe(false);
			}
		},
	);
});
