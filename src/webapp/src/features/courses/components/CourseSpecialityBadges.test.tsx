import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CourseSpecialityBadges } from "./CourseSpecialityBadges";

describe("CourseSpecialityBadges", () => {
	it("should toggle items on click", async () => {
		const user = userEvent.setup();
		const specialities = [
			{ speciality_id: "1", speciality_title: "Spec A" },
			{ speciality_id: "2", speciality_title: "Spec B" },
			{ speciality_id: "3", speciality_title: "Spec C" },
			{ speciality_id: "4", speciality_title: "Spec D" },
			{ speciality_id: "5", speciality_title: "Spec E" },
			{ speciality_id: "6", speciality_title: "Spec F" },
		];

		render(<CourseSpecialityBadges specialities={specialities} />);

		// Initially 5 items shown (SA to SE)
		expect(screen.getByText("SA")).toBeInTheDocument();
		expect(screen.getByText("SE")).toBeInTheDocument();
		// SF should be hidden (not rendered)
		expect(screen.queryByText("SF")).not.toBeInTheDocument();

		// Button should be visible
		const button = screen.getByRole("button");
		expect(button).toHaveTextContent("+1 більше");

		// Click to expand
		await user.click(button);

		// SF should be visible now
		expect(screen.getByText("SF")).toBeInTheDocument();

		// Button text changes
		expect(button).toHaveTextContent("Менше");

		// Click to collapse
		await user.click(button);

		// SF should be hidden again
		expect(screen.queryByText("SF")).not.toBeInTheDocument();
		expect(button).toHaveTextContent("+1 більше");
	});

	it("should not show badges for elective specialities", () => {
		const specialities = [
			{
				speciality_id: "1",
				speciality_title: "Spec A",
				type_kind: "COMPULSORY" as const,
			},
			{
				speciality_id: "2",
				speciality_title: "Spec B",
				type_kind: "ELECTIVE" as const,
			},
			{
				speciality_id: "3",
				speciality_title: "Spec C",
				type_kind: "PROF_ORIENTED" as const,
			},
			{
				speciality_id: "4",
				speciality_title: "Spec D",
				type_kind: "ELECTIVE" as const,
			},
		];

		render(<CourseSpecialityBadges specialities={specialities} />);

		expect(screen.getByText("SA")).toBeInTheDocument();
		expect(screen.getByText("SC")).toBeInTheDocument();

		expect(screen.queryByText("SB")).not.toBeInTheDocument();
		expect(screen.queryByText("SD")).not.toBeInTheDocument();
	});

	it("should return null when all specialities are elective", () => {
		const specialities = [
			{
				speciality_id: "1",
				speciality_title: "Spec A",
				type_kind: "ELECTIVE" as const,
			},
			{
				speciality_id: "2",
				speciality_title: "Spec B",
				type_kind: "ELECTIVE" as const,
			},
		];

		const { container } = render(
			<CourseSpecialityBadges specialities={specialities} />,
		);

		expect(container.firstChild).toBeNull();
	});
});
