import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCoursesInstructorsRetrieve } from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { renderWithProviders, screen } from "@/test-utils/render";
import { CourseInstructors } from "./CourseInstructors";

vi.mock("@/lib/api/generated", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/api/generated")>()),
	useCoursesInstructorsRetrieve: vi.fn(),
}));

const mockedRetrieve = vi.mocked(useCoursesInstructorsRetrieve);

const respond = (studentsCounts: ReadonlyArray<number>) =>
	mockedRetrieve.mockReturnValue({
		data: {
			items: studentsCounts.map((students_count, index) => ({
				instructor: {
					id: `i-${index}`,
					first_name: "Марта",
					last_name: `Вигадана${index}`,
					patronymic: "",
				},
				ratings_count: students_count,
				offering_ratings_count: 0,
				students_count,
				recent_students_count: students_count,
				planned: false,
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
		expect(
			screen.getByRole("button", {
				name: "Вигадана0 Марта, обрали 3 студенти",
			}),
		).toBeInTheDocument();
		expect(screen.queryByText("Вигадана1 Марта")).not.toBeInTheDocument();
	});

	it("shows names only, comma-separated, with the count in sr-only text", () => {
		respond([4, 2]);

		renderWithProviders(<CourseInstructors courseId="c-1" />, {
			flags: { fe_course_instructors: true },
		});

		const row = screen.getByTestId(testIds.courseDetails.teachers);
		expect(row).toHaveTextContent(
			"Викладачі:Вигадана0 Марта, обрали 4 студенти,Вигадана1 Марта, обрали 2 студенти",
		);
		expect(row).not.toHaveTextContent("·");
		for (const count of screen.getAllByText(/обрали \d+ студент/)) {
			expect(count).toHaveClass("sr-only");
		}
	});

	it("shows the student count on hover over a name", async () => {
		const user = userEvent.setup();
		respond([3]);

		renderWithProviders(<CourseInstructors courseId="c-1" />, {
			flags: { fe_course_instructors: true },
		});

		await user.hover(screen.getByRole("button", { name: /Вигадана0 Марта/ }));

		expect(await screen.findByRole("tooltip")).toHaveTextContent(
			"обрали 3 студенти",
		);
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
