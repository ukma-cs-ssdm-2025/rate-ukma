import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { StudentRatingsDetailed } from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { renderWithProviders } from "@/test-utils/render";
import { MyRatingsPendingSection } from "./MyRatingsPendingSection";

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
	const seasons = ["FALL", "SPRING", "SUMMER"] as const;
	return {
		course_id: `course-${index}`,
		course_title: `Курс ${index}`,
		course_code: `9000${index}`,
		course_offering_id: `offering-${index}`,
		can_rate: true,
		rated: null,
		semester: { year: 2023 + (index % 3), season: seasons[index % 3] },
		...overrides,
	};
}

describe("MyRatingsPendingSection", () => {
	it("opens the rating modal from a pending row with an offering", async () => {
		const user = userEvent.setup();
		renderWithProviders(
			<MyRatingsPendingSection
				items={[makeCourse(1)]}
				variant="preview"
				onRatingChanged={vi.fn()}
			/>,
		);

		await user.click(screen.getByTestId(testIds.myRatings.leaveReviewLink));
		expect(screen.getByTestId(testIds.rating.modal)).toHaveTextContent(
			"Курс 1",
		);
	});

	it("shows only the most recent few pending courses under preview", () => {
		const items = Array.from({ length: 7 }, (_, index) =>
			makeCourse(index, { semester: { year: 2025, season: "FALL" } }),
		);
		renderWithProviders(
			<MyRatingsPendingSection
				items={items}
				variant="preview"
				onRatingChanged={vi.fn()}
				onShowAll={vi.fn()}
			/>,
		);

		expect(screen.getAllByTestId(testIds.myRatings.card)).toHaveLength(5);
		expect(
			screen.getByRole("button", { name: /Показати всі \(7\)/ }),
		).toBeInTheDocument();
	});

	it("groups pending courses by semester under the unrated tab", () => {
		renderWithProviders(
			<MyRatingsPendingSection
				items={[
					makeCourse(1, { semester: { year: 2025, season: "FALL" } }),
					makeCourse(2, { semester: { year: 2024, season: "SPRING" } }),
				]}
				variant="grouped"
				onRatingChanged={vi.fn()}
			/>,
		);

		expect(screen.getByText("Осінь")).toBeInTheDocument();
		expect(screen.getByText("Весна")).toBeInTheDocument();
		expect(screen.getAllByTestId(testIds.myRatings.card)).toHaveLength(2);
	});

	it("shows a quiet outline action instead of a primary button", () => {
		renderWithProviders(
			<MyRatingsPendingSection
				items={[makeCourse(1)]}
				variant="preview"
				onRatingChanged={vi.fn()}
			/>,
		);

		const action = screen.getByTestId(testIds.myRatings.leaveReviewLink);
		expect(action.tagName).toBe("BUTTON");
		expect(action.className).toContain("outline");
		expect(action.className).not.toContain("bg-primary");
	});
});
