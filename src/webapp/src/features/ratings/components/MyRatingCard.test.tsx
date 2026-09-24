import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { StudentRatingsDetailed } from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { renderWithProviders } from "@/test-utils/render";
import { CANNOT_RATE_TOOLTIP_TEXT } from "../definitions/ratingDefinitions";
import { MyRatingCard } from "./MyRatingCard";

vi.mock("@tanstack/react-router", async () => {
	const actual = await vi.importActual("@tanstack/react-router");
	return {
		...actual,
		Link: ({ children, ...props }: { children: React.ReactNode }) => (
			<a {...props}>{children}</a>
		),
	};
});

function makeCourse(
	overrides?: Partial<StudentRatingsDetailed>,
): StudentRatingsDetailed {
	return {
		course_id: "course-1",
		course_title: "Тестовий курс",
		course_code: "C101",
		course_offering_id: "offering-1",
		can_rate: true,
		rated: null,
		...overrides,
	};
}

describe("MyRatingCard", () => {
	it("renders a compact row without nested card chrome", () => {
		renderWithProviders(
			<MyRatingCard course={makeCourse()} onRatingChanged={vi.fn()} />,
		);

		const card = screen.getByTestId(testIds.myRatings.card);
		expect(card).not.toHaveClass("border-l-4");
		expect(card.style.borderLeftColor).toBe("");
		expect(
			screen.getByTestId(testIds.myRatings.leaveReviewLink),
		).toBeInTheDocument();
	});

	it("shows difficulty and usefulness values for rated courses", () => {
		renderWithProviders(
			<MyRatingCard
				course={makeCourse({
					rated: { id: "rating-1", difficulty: 4, usefulness: 5 },
				})}
				onRatingChanged={vi.fn()}
			/>,
		);

		expect(screen.getByText("Складність")).toBeInTheDocument();
		expect(screen.getByText("Корисність")).toBeInTheDocument();
		expect(screen.getByText("4.0")).toBeInTheDocument();
		expect(screen.getByText("5.0")).toBeInTheDocument();
		expect(
			screen.queryByTestId(testIds.myRatings.leaveReviewLink),
		).not.toBeInTheDocument();
	});

	it("shows the rated comment under the scores", () => {
		renderWithProviders(
			<MyRatingCard
				course={makeCourse({
					rated: {
						id: "rating-1",
						difficulty: 4,
						usefulness: 5,
						comment: "Багато практики, але саме вона вчить думати",
					},
				})}
				onRatingChanged={vi.fn()}
			/>,
		);

		expect(
			screen.getByText("Багато практики, але саме вона вчить думати"),
		).toBeInTheDocument();
	});

	it("shows edit and delete actions for rated courses", () => {
		renderWithProviders(
			<MyRatingCard
				course={makeCourse({
					rated: { id: "rating-1", difficulty: 4, usefulness: 5 },
				})}
				onRatingChanged={vi.fn()}
			/>,
		);

		expect(
			screen.getByTestId(testIds.myRatings.editButton),
		).toBeInTheDocument();
		expect(
			screen.getByTestId(testIds.myRatings.deleteButton),
		).toBeInTheDocument();
	});

	it("renders the default rate action without faculty-colored inline styles", () => {
		renderWithProviders(
			<MyRatingCard
				course={makeCourse({ faculty_name: "Факультет інформатики" })}
				onRatingChanged={vi.fn()}
			/>,
			{ flags: { fe_faculty_colors: true } },
		);

		const rateButton = screen.getByTestId(testIds.myRatings.leaveReviewLink);
		expect(rateButton.style.backgroundColor).toBe("");
		expect(rateButton.style.color).toBe("");
	});

	it("explains instead of rating when the course cannot be rated yet", async () => {
		renderWithProviders(
			<MyRatingCard
				course={makeCourse({ can_rate: false })}
				onRatingChanged={vi.fn()}
			/>,
		);

		const rate = screen.getByRole("button", { name: "Оцінити" });
		expect(rate).toHaveAttribute("aria-disabled", "true");
		await userEvent.click(rate);
		expect(await screen.findByRole("tooltip")).toHaveTextContent(
			CANNOT_RATE_TOOLTIP_TEXT,
		);
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});
});
