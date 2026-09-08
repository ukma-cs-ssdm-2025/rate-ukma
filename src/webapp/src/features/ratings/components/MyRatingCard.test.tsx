import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { StudentRatingsDetailed } from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { renderWithProviders } from "@/test-utils/render";
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

describe("MyRatingCard faculty accent", () => {
	it("paints the accent bar and Rate button in the faculty color", () => {
		renderWithProviders(
			<MyRatingCard
				course={makeCourse({ faculty_name: "Факультет інформатики" })}
				onRatingChanged={vi.fn()}
			/>,
		);

		expect(screen.getByTestId(testIds.myRatings.card)).toHaveStyle({
			borderLeftColor: "#4c217a",
		});

		const rateButton = screen.getByTestId(testIds.myRatings.leaveReviewLink);
		expect(rateButton).toHaveStyle({
			backgroundColor: "#4c217a",
			color: "#ffffff",
		});
	});

	it("keeps the accent bar on rated cards without a Rate button", () => {
		renderWithProviders(
			<MyRatingCard
				course={makeCourse({
					faculty_name: "Факультет природничих наук",
					rated: { id: "rating-1", difficulty: 4, usefulness: 5 },
				})}
				onRatingChanged={vi.fn()}
			/>,
		);

		expect(screen.getByTestId(testIds.myRatings.card)).toHaveStyle({
			borderLeftColor: "#006e31",
		});
		expect(
			screen.queryByTestId(testIds.myRatings.leaveReviewLink),
		).not.toBeInTheDocument();
	});

	it("uses dark button text on the light yellow faculty", () => {
		renderWithProviders(
			<MyRatingCard
				course={makeCourse({
					faculty_name: "Факультет соціальних наук і соціальних технологій",
				})}
				onRatingChanged={vi.fn()}
			/>,
		);

		expect(screen.getByTestId(testIds.myRatings.leaveReviewLink)).toHaveStyle({
			backgroundColor: "#f6b213",
			color: "#1a1a1a",
		});
	});

	it("falls back to default styling when no faculty is assigned", () => {
		renderWithProviders(
			<MyRatingCard
				course={makeCourse({ faculty_name: null })}
				onRatingChanged={vi.fn()}
			/>,
		);

		expect(screen.getByTestId(testIds.myRatings.card)).not.toHaveStyle({
			borderLeftColor: "#4c217a",
		});

		const rateButton = screen.getByTestId(testIds.myRatings.leaveReviewLink);
		expect(rateButton.style.backgroundColor).toBe("");
		expect(rateButton.style.color).toBe("");
	});

	it("paints the disabled button in the faculty color", () => {
		renderWithProviders(
			<MyRatingCard
				course={makeCourse({
					faculty_name: "Факультет інформатики",
					can_rate: false,
				})}
				onRatingChanged={vi.fn()}
			/>,
		);

		const rateButton = screen.getByRole("button", { name: "Оцінити" });
		expect(rateButton).toBeDisabled();
		expect(rateButton).toHaveClass("opacity-50");
		expect(rateButton).toHaveStyle({
			backgroundColor: "#4c217a",
			color: "#ffffff",
		});
	});
});
