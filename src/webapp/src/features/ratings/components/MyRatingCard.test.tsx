import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
	InlineRatingDetailed,
	StudentRatingsDetailed,
} from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { Providers } from "@/test-utils/render";
import { renderWithRouter } from "@/test-utils/router";
import { MyRatingCard } from "./MyRatingCard";

function makeRating(
	overrides?: Partial<InlineRatingDetailed>,
): InlineRatingDetailed {
	return {
		id: "rating-5f2a",
		difficulty: 4,
		usefulness: 5,
		comment: "Добрий курс.",
		instructor: null,
		instructors: [],
		created_at: new Date().toISOString(),
		is_anonymous: false,
		...overrides,
	};
}

function makeCourse(
	overrides?: Partial<StudentRatingsDetailed>,
): StudentRatingsDetailed {
	return {
		course_id: "course-9c4e",
		course_title: "Тестовий курс",
		course_code: "C101",
		course_offering_id: "offering-2b7d",
		semester: { year: 2025, season: "FALL" },
		can_rate: true,
		rated: null,
		...overrides,
	};
}

async function renderCard(
	course: StudentRatingsDetailed,
	flags?: Record<string, boolean>,
) {
	await renderWithRouter(
		<Providers flags={flags}>
			<MyRatingCard course={course} onRatingChanged={vi.fn()} />
		</Providers>,
	);
}

describe("MyRatingCard faculty accent", () => {
	it("paints the accent bar and Rate button in the faculty color", async () => {
		await renderCard(makeCourse({ faculty_name: "Факультет інформатики" }), {
			fe_faculty_colors: true,
		});

		expect(screen.getByTestId(testIds.myRatings.card)).toHaveStyle({
			borderLeftColor: "#4c217a",
		});

		const rateButton = screen.getByTestId(testIds.myRatings.leaveReviewLink);
		expect(rateButton).toHaveStyle({
			backgroundColor: "#4c217a",
			color: "#ffffff",
		});
	});

	it("keeps the accent bar on rated cards without a Rate button", async () => {
		await renderCard(
			makeCourse({
				faculty_name: "Факультет природничих наук",
				rated: makeRating(),
			}),
			{ fe_faculty_colors: true },
		);

		const card = screen.getByTestId(testIds.myRatings.card);
		expect(card).toHaveStyle({ borderLeftColor: "#006e31" });
		expect(card).toHaveClass("border-l-4");
		expect(
			screen.queryByTestId(testIds.myRatings.leaveReviewLink),
		).not.toBeInTheDocument();
	});

	it("uses dark button text on the light yellow faculty", async () => {
		await renderCard(
			makeCourse({
				faculty_name: "Факультет соціальних наук і соціальних технологій",
			}),
			{ fe_faculty_colors: true },
		);

		expect(screen.getByTestId(testIds.myRatings.leaveReviewLink)).toHaveStyle({
			backgroundColor: "#f6b213",
			color: "#1a1a1a",
		});
	});
	it("keeps default blue styling when the flag is off", async () => {
		await renderCard(makeCourse({ faculty_name: "Факультет інформатики" }));

		const rateButton = screen.getByTestId(testIds.myRatings.leaveReviewLink);
		expect(rateButton.style.backgroundColor).toBe("");
		expect(rateButton.style.color).toBe("");
	});

	it("falls back to default styling when no faculty is assigned", async () => {
		await renderCard(makeCourse({ faculty_name: null }));

		expect(screen.getByTestId(testIds.myRatings.card)).not.toHaveStyle({
			borderLeftColor: "#4c217a",
		});

		const rateButton = screen.getByTestId(testIds.myRatings.leaveReviewLink);
		expect(rateButton.style.backgroundColor).toBe("");
		expect(rateButton.style.color).toBe("");
	});

	it("paints the disabled button in the faculty color", async () => {
		await renderCard(
			makeCourse({
				faculty_name: "Факультет інформатики",
				can_rate: false,
			}),
			{ fe_faculty_colors: true },
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
