import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCoursesInstructorsRetrieve } from "@/lib/api/generated";
import { renderWithProviders, screen } from "@/test-utils/render";
import { CourseInstructors } from "./CourseInstructors";

vi.mock("@/lib/api/generated", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/api/generated")>()),
	useCoursesInstructorsRetrieve: vi.fn(),
}));

const mockedRetrieve = vi.mocked(useCoursesInstructorsRetrieve);

const respond = (ratingsCounts: ReadonlyArray<number>) =>
	mockedRetrieve.mockReturnValue({
		data: {
			items: ratingsCounts.map((ratings_count, index) => ({
				instructor: {
					id: `i-${index}`,
					first_name: "Марта",
					last_name: `Вигадана${index}`,
					patronymic: "",
				},
				ratings_count,
				offering_ratings_count: 0,
			})),
		},
	} as unknown as ReturnType<typeof useCoursesInstructorsRetrieve>);

describe("CourseInstructors", () => {
	beforeEach(() => {
		mockedRetrieve.mockReset();
	});

	it("shows the teachers named at least twice when the flag is on", () => {
		respond([3, 1]);

		renderWithProviders(<CourseInstructors courseId="c-1" />, {
			flags: { fe_course_instructors: true },
		});

		expect(
			screen.getByRole("heading", { name: "Викладачі:" }),
		).toBeInTheDocument();
		expect(screen.getByText("Вигадана0 Марта")).toBeInTheDocument();
		expect(screen.getByText(/обрали 3 студенти/)).toBeInTheDocument();
		expect(screen.queryByText("Вигадана1 Марта")).not.toBeInTheDocument();
	});

	it("hides the row when nobody qualifies", () => {
		respond([1]);

		renderWithProviders(<CourseInstructors courseId="c-1" />, {
			flags: { fe_course_instructors: true },
		});

		expect(screen.queryByText("Викладачі:")).not.toBeInTheDocument();
	});

	it("renders nothing and fetches nothing when the flag is off", () => {
		respond([3]);

		renderWithProviders(<CourseInstructors courseId="c-1" />, {
			flags: { fe_course_instructors: false },
		});

		expect(screen.queryByText("Викладачі:")).not.toBeInTheDocument();
		expect(mockedRetrieve).toHaveBeenCalledWith("c-1", undefined, {
			query: { enabled: false },
		});
	});
});
