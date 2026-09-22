import { beforeEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import * as infiniteHooks from "../hooks/useInfiniteInstructors";
import { InstructorFilterSelect } from "./InstructorFilterSelect";

function mockHook() {
	vi.spyOn(infiniteHooks, "useInfiniteInstructors").mockReturnValue({
		allInstructors: [],
		total: 0,
		hasMore: false,
		isLoading: false,
		isFetchingNextPage: false,
		loaderRef: { current: null },
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	mockHook();
});

describe("InstructorFilterSelect", () => {
	it("should forward mentionedOnly to the instructors query", () => {
		render(
			<InstructorFilterSelect value="" onChange={vi.fn()} mentionedOnly />,
		);

		expect(screen.getByRole("combobox")).toBeInTheDocument();
		expect(
			vi.mocked(infiniteHooks.useInfiniteInstructors),
		).toHaveBeenCalledWith(expect.objectContaining({ mentionedOnly: true }));
	});

	it("should not scope the query by default", () => {
		render(<InstructorFilterSelect value="" onChange={vi.fn()} />);

		expect(
			vi.mocked(infiniteHooks.useInfiniteInstructors),
		).toHaveBeenCalledWith(expect.objectContaining({ mentionedOnly: false }));
	});
});
