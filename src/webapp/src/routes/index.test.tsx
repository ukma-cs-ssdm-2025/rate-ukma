import type { ReactNode } from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as LayoutModule from "@/components/Layout";
import {
	DEFAULT_COURSE_FILTERS_PARAMS,
	type CourseFiltersParamsSetter,
	type CourseFiltersParamsState,
} from "@/features/courses/courseFiltersParams";
import * as filtersParams from "@/features/courses/courseFiltersParams";
import * as CoursesTableModule from "@/features/courses/components/CoursesTable";
import * as FeedStripModule from "@/features/feed/components/FeedStrip";
import * as PromoBannerModule from "@/features/promo/components/PromoBanner";
import type { CourseListResponse } from "@/lib/api/generated";
import * as generated from "@/lib/api/generated";
import { CoursesRoute } from "./index";

interface CoursesListStub {
	data: CourseListResponse | undefined;
	isFetching: boolean;
	isError: boolean;
	refetch: ((...args: any[]) => any) | ReturnType<typeof vi.fn>;
}

function coursesListStub(
	data: CourseListResponse | undefined,
	isError: boolean,
	refetch: ReturnType<typeof vi.fn>,
): CoursesListStub {
	return { data, isFetching: false, isError, refetch };
}

function mockFiltersParams(
	params: Partial<CourseFiltersParamsState>,
	setParams: ReturnType<typeof vi.fn>,
) {
	vi.spyOn(filtersParams, "useCourseFiltersParams").mockReturnValue(
		// SAFETY: the route only reads the state and calls setParams.
		[{ ...DEFAULT_COURSE_FILTERS_PARAMS, ...params }, setParams] as [
			CourseFiltersParamsState,
			CourseFiltersParamsSetter,
		],
	);
}

describe("CoursesRoute", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(LayoutModule, "default").mockImplementation(
			({ children }: { children: ReactNode }) => <>{children}</>,
		);
		vi.spyOn(CoursesTableModule, "CoursesTable").mockImplementation(
			({ params }: { params: { q: string } }) => (
				<div>
					<div data-testid="courses-table" />
					<input data-testid="courses-search-input" readOnly value={params.q} />
				</div>
			),
		);
		// Covered by its own test; stubbed here so this file needs no flags provider.
		vi.spyOn(PromoBannerModule, "PromoBanner").mockImplementation(() => null);
		vi.spyOn(FeedStripModule, "FeedStrip").mockImplementation(() => null);
	});

	it("renders error state and calls refetch on retry", async () => {
		const user = userEvent.setup();
		const setParams = vi.fn();
		mockFiltersParams({ q: "test" }, setParams);

		const refetch = vi.fn();
		vi.spyOn(generated, "useCoursesList").mockReturnValue(
			// SAFETY: CoursesRoute only reads data/isFetching/isError/refetch.
			coursesListStub(undefined, true, refetch) as ReturnType<
				typeof generated.useCoursesList
			>,
		);

		render(<CoursesRoute />);

		const retryButton = screen.getByTestId("courses-retry-button");
		await user.click(retryButton);

		expect(refetch).toHaveBeenCalledTimes(1);
		expect(setParams).not.toHaveBeenCalled();
	});

	it("renders courses table when query succeeds", () => {
		const setParams = vi.fn();
		mockFiltersParams({ q: "persisted" }, setParams);

		vi.spyOn(generated, "useCoursesList").mockReturnValue(
			// SAFETY: CoursesRoute only reads data/isFetching/isError/refetch.
			coursesListStub(
				{
					items: [],
					page: 1,
					page_size: 10,
					total: 0,
					total_pages: 0,
					filters: {},
					next_page: null,
					previous_page: null,
				},
				false,
				vi.fn(),
			) as ReturnType<typeof generated.useCoursesList>,
		);

		render(<CoursesRoute />);

		expect(screen.queryByTestId("courses-error-state")).not.toBeInTheDocument();
		expect(screen.getByTestId("courses-table")).toBeInTheDocument();
		expect(screen.getByTestId("courses-search-input")).toHaveValue("persisted");
		expect(vi.mocked(generated.useCoursesList)).toHaveBeenCalledWith(
			expect.objectContaining({ last_review_order: undefined }),
			expect.anything(),
		);
	});

	it("uses newest review sorting when explicitly selected", () => {
		const setParams = vi.fn();
		mockFiltersParams({ reviewSort: "newest" }, setParams);

		vi.spyOn(generated, "useCoursesList").mockReturnValue(
			// SAFETY: CoursesRoute only reads data/isFetching/isError/refetch.
			coursesListStub(
				{
					items: [],
					page: 1,
					page_size: 10,
					total: 0,
					total_pages: 0,
					filters: {},
					next_page: null,
					previous_page: null,
				},
				false,
				vi.fn(),
			) as ReturnType<typeof generated.useCoursesList>,
		);

		render(<CoursesRoute />);

		expect(vi.mocked(generated.useCoursesList)).toHaveBeenCalledWith(
			expect.objectContaining({ last_review_order: "desc" }),
			expect.anything(),
		);
	});
});
