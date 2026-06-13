import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Instructor, InstructorsListParams } from "@/lib/api/generated";
import { useInfiniteInstructors } from "./useInfiniteInstructors";

// Mock the orval-generated infinite query hook
vi.mock("@/lib/api/generated", async () => {
	const actual = await vi.importActual("@/lib/api/generated");
	return {
		...actual,
		useInstructorsListInfinite: vi.fn(),
	};
});

const { useInstructorsListInfinite } = await import("@/lib/api/generated");
const mockedInfinite = vi.mocked(useInstructorsListInfinite);

interface MockPage {
	items: Instructor[];
	total: number;
	next_page: number | null;
}

function createMockInfiniteReturn(
	overrides: Partial<{
		pages: MockPage[];
		hasNextPage: boolean;
		isFetchingNextPage: boolean;
		isLoading: boolean;
	}> = {},
) {
	const pages = overrides.pages ?? [];
	return {
		data: pages.length > 0 ? { pages, pageParams: [] } : undefined,
		fetchNextPage: vi.fn(),
		hasNextPage: overrides.hasNextPage ?? false,
		isFetchingNextPage: overrides.isFetchingNextPage ?? false,
		isLoading: overrides.isLoading ?? false,
	} as unknown as ReturnType<typeof useInstructorsListInfinite>;
}

function createMockInstructor(overrides: Partial<Instructor> = {}): Instructor {
	return {
		id: "instructor-1",
		first_name: "Іван",
		last_name: "Іваненко",
		...overrides,
	};
}

/** Read the params passed to the most recent useInstructorsListInfinite call */
function lastCallParams(): InstructorsListParams {
	const calls = mockedInfinite.mock.calls;
	return calls[calls.length - 1][0] as InstructorsListParams;
}

beforeEach(() => {
	vi.clearAllMocks();
	mockedInfinite.mockReturnValue(createMockInfiniteReturn());
});

describe("useInfiniteInstructors", () => {
	describe("Query Params", () => {
		it("should omit empty search, courseOfferingId, and specialityId", () => {
			// Act
			renderHook(() => useInfiniteInstructors());

			// Assert
			expect(lastCallParams()).toEqual({ page_size: 20 });
		});

		it("should include provided filters with snake_case keys", () => {
			// Act
			renderHook(() =>
				useInfiniteInstructors({
					search: "Іван",
					courseOfferingId: "offering-1",
					specialityId: "spec-1",
				}),
			);

			// Assert
			expect(lastCallParams()).toEqual({
				page_size: 20,
				search: "Іван",
				course_offering_id: "offering-1",
				speciality_id: "spec-1",
			});
		});

		it("should respect a custom pageSize", () => {
			// Act
			renderHook(() => useInfiniteInstructors({ pageSize: 50 }));

			// Assert
			expect(lastCallParams()).toEqual({ page_size: 50 });
		});
	});

	describe("Derived Output", () => {
		it("should flat-map instructors across multiple pages", () => {
			// Arrange
			const a = createMockInstructor({ id: "a" });
			const b = createMockInstructor({ id: "b" });
			const c = createMockInstructor({ id: "c" });
			mockedInfinite.mockReturnValue(
				createMockInfiniteReturn({
					pages: [
						{ items: [a, b], total: 3, next_page: 2 },
						{ items: [c], total: 3, next_page: null },
					],
				}),
			);

			// Act
			const { result } = renderHook(() => useInfiniteInstructors());

			// Assert
			expect(result.current.allInstructors).toEqual([a, b, c]);
		});

		it("should expose total from the first page", () => {
			// Arrange
			mockedInfinite.mockReturnValue(
				createMockInfiniteReturn({
					pages: [
						{ items: [createMockInstructor()], total: 42, next_page: 2 },
						{ items: [], total: 99, next_page: null },
					],
				}),
			);

			// Act
			const { result } = renderHook(() => useInfiniteInstructors());

			// Assert
			expect(result.current.total).toBe(42);
		});

		it("should return an empty list and undefined total when no data", () => {
			// Act
			const { result } = renderHook(() => useInfiniteInstructors());

			// Assert
			expect(result.current.allInstructors).toEqual([]);
			expect(result.current.total).toBeUndefined();
		});

		it("should derive hasMore from hasNextPage", () => {
			// Arrange
			mockedInfinite.mockReturnValue(
				createMockInfiniteReturn({
					pages: [{ items: [createMockInstructor()], total: 1, next_page: 2 }],
					hasNextPage: true,
				}),
			);

			// Act
			const { result } = renderHook(() => useInfiniteInstructors());

			// Assert
			expect(result.current.hasMore).toBe(true);
		});

		it("should report hasMore as false when there is no next page", () => {
			// Arrange
			mockedInfinite.mockReturnValue(
				createMockInfiniteReturn({
					pages: [
						{ items: [createMockInstructor()], total: 1, next_page: null },
					],
					hasNextPage: false,
				}),
			);

			// Act
			const { result } = renderHook(() => useInfiniteInstructors());

			// Assert
			expect(result.current.hasMore).toBe(false);
		});
	});

	describe("Query Options", () => {
		it("should forward enabled=false to the query options", () => {
			// Act
			renderHook(() => useInfiniteInstructors({ enabled: false }));

			// Assert
			const options = mockedInfinite.mock.calls.at(-1)?.[1];
			expect(options?.query?.enabled).toBe(false);
		});

		it("should default enabled to true", () => {
			// Act
			renderHook(() => useInfiniteInstructors());

			// Assert
			const options = mockedInfinite.mock.calls.at(-1)?.[1];
			expect(options?.query?.enabled).toBe(true);
		});
	});
});
