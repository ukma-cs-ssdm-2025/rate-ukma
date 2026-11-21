import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { createMockOfferingSpeciality } from "@/test-utils/factories";
import { CourseSpecialityBadges } from "./CourseSpecialityBadges";

describe("CourseSpecialityBadges", () => {
	it("should toggle items on click", async () => {
		const user = userEvent.setup();
		const specialities = [
			createMockOfferingSpeciality({
				speciality_id: "1",
				speciality_title: "Spec A",
			}),
			createMockOfferingSpeciality({
				speciality_id: "2",
				speciality_title: "Spec B",
			}),
			createMockOfferingSpeciality({
				speciality_id: "3",
				speciality_title: "Spec C",
			}),
			createMockOfferingSpeciality({
				speciality_id: "4",
				speciality_title: "Spec D",
			}),
			createMockOfferingSpeciality({
				speciality_id: "5",
				speciality_title: "Spec E",
			}),
			createMockOfferingSpeciality({
				speciality_id: "6",
				speciality_title: "Spec F",
			}),
		];

		render(<CourseSpecialityBadges specialities={specialities} />);

		expect(screen.getByText("SA")).toBeInTheDocument();
		expect(screen.getByText("SE")).toBeInTheDocument();
		expect(screen.queryByText("SF")).not.toBeInTheDocument();

		const button = screen.getByRole("button");
		expect(button).toHaveTextContent("ще 1");

		await user.click(button);

		expect(screen.getByText("SF")).toBeInTheDocument();

		expect(button).toHaveTextContent("Згорнути");

		await user.click(button);

		expect(screen.queryByText("SF")).not.toBeInTheDocument();
		expect(button).toHaveTextContent("ще 1");
	});

	it("should not show badges for elective specialities", () => {
		const specialities = [
			createMockOfferingSpeciality({
				speciality_id: "1",
				speciality_title: "Spec A",
				type_kind: "COMPULSORY",
			}),
			createMockOfferingSpeciality({
				speciality_id: "2",
				speciality_title: "Spec B",
				type_kind: "ELECTIVE",
			}),
			createMockOfferingSpeciality({
				speciality_id: "3",
				speciality_title: "Spec C",
				type_kind: "PROF_ORIENTED",
			}),
			createMockOfferingSpeciality({
				speciality_id: "4",
				speciality_title: "Spec D",
				type_kind: "ELECTIVE",
			}),
		];

		render(<CourseSpecialityBadges specialities={specialities} />);

		expect(screen.getByText("SA")).toBeInTheDocument();
		expect(screen.getByText("SC")).toBeInTheDocument();

		expect(screen.queryByText("SB")).not.toBeInTheDocument();
		expect(screen.queryByText("SD")).not.toBeInTheDocument();
	});

	it("should return null when all specialities are elective", () => {
		const specialities = [
			createMockOfferingSpeciality({
				speciality_id: "1",
				speciality_title: "Spec A",
				type_kind: "ELECTIVE",
			}),
			createMockOfferingSpeciality({
				speciality_id: "2",
				speciality_title: "Spec B",
				type_kind: "ELECTIVE",
			}),
		];

		const { container } = render(
			<CourseSpecialityBadges specialities={specialities} />,
		);

		expect(container.firstChild).toBeNull();
	});
});
