import { beforeEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { InstructorFilterSelect } from "./InstructorFilterSelect";
import { useInfiniteInstructors } from "../hooks/useInfiniteInstructors";

vi.mock("../hooks/useInfiniteInstructors", () => ({
	useInfiniteInstructors: vi.fn(),
}));

const mockedHook = vi.mocked(useInfiniteInstructors);

function mockHook() {
	mockedHook.mockReturnValue({
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
		expect(mockedHook).toHaveBeenCalledWith(
			expect.objectContaining({ mentionedOnly: true }),
		);
	});

	it("should not scope the query by default", () => {
		render(<InstructorFilterSelect value="" onChange={vi.fn()} />);

		expect(mockedHook).toHaveBeenCalledWith(
			expect.objectContaining({ mentionedOnly: false }),
		);
	});
});
