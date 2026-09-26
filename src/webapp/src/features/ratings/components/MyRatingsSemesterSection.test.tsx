import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StudentRatingsDetailed } from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { renderWithProviders } from "@/test-utils/render";
import type { SemesterGroup } from "../groupRatings";
import { MyRatingsSemesterSection } from "./MyRatingsSemesterSection";

vi.mock("@tanstack/react-router", async () => {
	const actual = await vi.importActual("@tanstack/react-router");
	return {
		...actual,
		Link: ({ children, ...props }: { children: React.ReactNode }) => (
			<a {...props}>{children}</a>
		),
	};
});

vi.mock("./RatingModal", () => ({
	RatingModal: ({
		isOpen,
		courseName,
	}: {
		isOpen: boolean;
		courseName?: string;
	}) =>
		isOpen ? (
			<div data-testid={testIds.rating.modal}>modal for {courseName}</div>
		) : null,
}));

function makeCourse(
	index: number,
	overrides?: Partial<StudentRatingsDetailed>,
): StudentRatingsDetailed {
	return {
		course_id: `course-${index}`,
		course_title: `Курс ${index}`,
		course_code: `9000${index}`,
		course_offering_id: `offering-${index}`,
		can_rate: true,
		rated: null,
		semester: { year: 2025, season: "FALL" },
		...overrides,
	};
}

function makeSemester(
	items: StudentRatingsDetailed[],
	overrides?: Partial<SemesterGroup>,
): SemesterGroup {
	const ratedCount = items.filter((item) => Boolean(item.rated)).length;
	return {
		key: "2025-FALL",
		label: "Осінь",
		description: "Семестр осінь",
		items,
		order: 1,
		ratedCount,
		totalCount: items.length,
		unratedRateableCount: items.length - ratedCount,
		year: 2025,
		seasonRaw: "FALL",
		...overrides,
	};
}

describe("MyRatingsSemesterSection", () => {
	it("lists rated and unrated courses of an open semester", () => {
		renderWithProviders(
			<MyRatingsSemesterSection
				seasonGroup={makeSemester([
					makeCourse(1, {
						rated: { id: "rating-1", difficulty: 4, usefulness: 5 },
					}),
					makeCourse(2),
				])}
				onRatingChanged={vi.fn()}
			/>,
		);

		expect(screen.getAllByTestId(testIds.myRatings.card)).toHaveLength(2);
		expect(screen.getByText("Курс 1")).toBeInTheDocument();
		expect(screen.getByText("Курс 2")).toBeInTheDocument();
	});

	it("lists unrated courses before rated ones", () => {
		renderWithProviders(
			<MyRatingsSemesterSection
				seasonGroup={makeSemester([
					makeCourse(1, {
						rated: { id: "rating-1", difficulty: 4, usefulness: 5 },
					}),
					makeCourse(2),
				])}
				onRatingChanged={vi.fn()}
			/>,
		);

		const cards = screen.getAllByTestId(testIds.myRatings.card);
		expect(cards[0]).toHaveTextContent("Курс 2");
		expect(cards[1]).toHaveTextContent("Курс 1");
	});

	it("opens the rating modal from an unrated row", async () => {
		const user = userEvent.setup();
		renderWithProviders(
			<MyRatingsSemesterSection
				seasonGroup={makeSemester([makeCourse(1)])}
				onRatingChanged={vi.fn()}
			/>,
		);

		await user.click(screen.getByTestId(testIds.myRatings.leaveReviewLink));
		expect(screen.getByTestId(testIds.rating.modal)).toHaveTextContent(
			"Курс 1",
		);
	});

	it("uses the primary action for unrated rows", () => {
		renderWithProviders(
			<MyRatingsSemesterSection
				seasonGroup={makeSemester([makeCourse(1)])}
				onRatingChanged={vi.fn()}
			/>,
		);

		const action = screen.getByTestId(testIds.myRatings.leaveReviewLink);
		expect(action.tagName).toBe("BUTTON");
		expect(action.className).not.toContain("bg-secondary");
	});

	describe("which semesters start open", () => {
		const trigger = () => screen.getByTestId(testIds.myRatings.semesterTrigger);

		beforeEach(() => {
			localStorage.clear();
			vi.useFakeTimers({ toFake: ["Date"] });
			vi.setSystemTime(new Date(2026, 9, 10));
		});

		afterEach(() => {
			vi.useRealTimers();
			localStorage.clear();
		});

		it("keeps a semester that has not started collapsed", () => {
			renderWithProviders(
				<MyRatingsSemesterSection
					seasonGroup={makeSemester([makeCourse(1, { can_rate: false })], {
						year: 2027,
						seasonRaw: "SPRING",
						key: "SPRING",
						unratedRateableCount: 0,
					})}
					onRatingChanged={vi.fn()}
				/>,
			);

			expect(trigger()).toHaveAttribute("data-state", "closed");
			expect(screen.getByText("Ще не розпочався")).toBeInTheDocument();
		});

		it("opens the running semester and says when rating opens", () => {
			renderWithProviders(
				<MyRatingsSemesterSection
					seasonGroup={makeSemester([makeCourse(1, { can_rate: false })], {
						year: 2026,
						unratedRateableCount: 0,
					})}
					onRatingChanged={vi.fn()}
				/>,
			);

			expect(trigger()).toHaveAttribute("data-state", "open");
			expect(screen.getByText("Оцінювання з 1 листопада")).toBeInTheDocument();
		});

		it("asks for ratings only while the semester is collapsed", async () => {
			const user = userEvent.setup();
			renderWithProviders(
				<MyRatingsSemesterSection
					seasonGroup={makeSemester([makeCourse(1), makeCourse(2)])}
					onRatingChanged={vi.fn()}
				/>,
			);

			expect(trigger()).toHaveAttribute("data-state", "open");
			expect(screen.queryByText(/Оцініть ще/)).not.toBeInTheDocument();

			await user.click(trigger());

			expect(screen.getByText("Оцініть ще 2 курси")).toBeInTheDocument();
		});

		it("remembers a choice within the term and forgets it in the next", async () => {
			const user = userEvent.setup();
			const semester = makeSemester([makeCourse(1)]);
			const view = () =>
				renderWithProviders(
					<MyRatingsSemesterSection
						seasonGroup={semester}
						onRatingChanged={vi.fn()}
					/>,
				);

			const first = view();
			await user.click(trigger());
			first.unmount();

			const second = view();
			expect(trigger()).toHaveAttribute("data-state", "closed");
			second.unmount();

			vi.setSystemTime(new Date(2027, 0, 20));
			view();
			expect(trigger()).toHaveAttribute("data-state", "open");
		});
	});
});
