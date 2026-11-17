import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
	RATINGS_SORT_STORAGE_KEY,
	useRatingsSortOption,
} from "./useRatingsSortOption";

describe("useRatingsSortOption", () => {
	afterEach(() => localStorage.clear());

	it("defaults to most popular when nothing is stored", () => {
		const { result } = renderHook(() => useRatingsSortOption());
		expect(result.current[0]).toBe("most-popular");
	});

	it("restores the stored sort", () => {
		localStorage.setItem(RATINGS_SORT_STORAGE_KEY, JSON.stringify("oldest"));
		const { result } = renderHook(() => useRatingsSortOption());
		expect(result.current[0]).toBe("oldest");
	});

	it.each([
		["an unknown option", JSON.stringify("by-likes")],
		["a non-string", JSON.stringify(42)],
		["broken JSON", "{"],
	])("falls back to the default for %s", (_name, raw) => {
		localStorage.setItem(RATINGS_SORT_STORAGE_KEY, raw);
		const { result } = renderHook(() => useRatingsSortOption());
		expect(result.current[0]).toBe("most-popular");
	});

	it("saves the chosen sort for the next mount", () => {
		const first = renderHook(() => useRatingsSortOption());
		act(() => first.result.current[1]("newest"));
		expect(first.result.current[0]).toBe("newest");

		const second = renderHook(() => useRatingsSortOption());
		expect(second.result.current[0]).toBe("newest");
	});
});
