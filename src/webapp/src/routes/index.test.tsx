import type { ReactNode } from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
	DEFAULT_COURSE_FILTERS_PARAMS,
	useCourseFiltersParams,
} from "@/features/courses/courseFiltersParams";
import { useCoursesList } from "@/lib/api/generated";
import { CoursesRoute } from "./index";

vi.mock("@/components/Layout", () => {
	return {
		default: ({ children }: { children: ReactNode }) => <>{children}</>,
	};
});

vi.mock("@/features/courses/components/CoursesTable", () => {
	return {
		CoursesTable: ({ params }: { params: { q: string } }) => (
			<div>
				<div data-testid="courses-table" />
				<input data-testid="courses-search-input" readOnly value={params.q} />
			</div>
		),
	};
});

vi.mock("@/features/courses/courseFiltersParams", async () => {
	const actual = await vi.importActual<
		typeof import("@/features/courses/courseFiltersParams")
	>("@/features/courses/courseFiltersParams");

	return {
		...actual,
		useCourseFiltersParams: vi.fn(),
	};
});

vi.mock("@/lib/api/generated", () => {
	return {
		useCoursesList: vi.fn(),
	};
});

describe("CoursesRoute", () => {
	it("renders error state and calls refetch on retry", async () => {
		const user = userEvent.setup();
		const setParams = vi.fn();
		vi.mocked(useCourseFiltersParams).mockReturnValue([
			{ ...DEFAULT_COURSE_FILTERS_PARAMS, q: "test" },
			setParams,
		]);

		const refetch = vi.fn();
		vi.mocked(useCoursesList).mockReturnValue({
			data: undefined,
			isFetching: false,
			isError: true,
			refetch,
		} as unknown as ReturnType<typeof useCoursesList>);

		render(<CoursesRoute />);

		const retryButton = screen.getByTestId("courses-retry-button");
		await user.click(retryButton);

		expect(refetch).toHaveBeenCalledTimes(1);
		expect(setParams).not.toHaveBeenCalled();
	});

	it("renders courses table when query succeeds", () => {
		const setParams = vi.fn();
		vi.mocked(useCourseFiltersParams).mockReturnValue([
			{ ...DEFAULT_COURSE_FILTERS_PARAMS, q: "persisted" },
			setParams,
		]);

		vi.mocked(useCoursesList).mockReturnValue({
			data: {
				items: [],
				page: 1,
				page_size: 10,
				total: 0,
				total_pages: 0,
			},
			isFetching: false,
			isError: false,
			refetch: vi.fn(),
		} as unknown as ReturnType<typeof useCoursesList>);

		render(<CoursesRoute />);

		expect(screen.queryByTestId("courses-error-state")).not.toBeInTheDocument();
		expect(screen.getByTestId("courses-table")).toBeInTheDocument();
		expect(screen.getByTestId("courses-search-input")).toHaveValue("persisted");
	});
});
