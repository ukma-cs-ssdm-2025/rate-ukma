import { describe, expect, it } from "vitest";

import type { RatingInstructor } from "@/lib/api/generated";
import { render, screen } from "@/test-utils/render";
import { RatingCardBody } from "./RatingCardBody";

const baseProps = {
	displayName: "Студент",
	isAnonymous: false,
	difficulty: 3,
	usefulness: 4,
	upvotes: 0,
	downvotes: 0,
	viewerVote: null,
} as const;

function instructor(over: Partial<RatingInstructor>): RatingInstructor {
	return {
		id: "00000000-0000-0000-0000-000000000000",
		first_name: "",
		patronymic: "",
		last_name: "",
		...over,
	};
}

// M2M instructor display is gated behind the feature flag.
const FF_ON = { flags: { fe_instructor_multiselect: true } } as const;

describe("RatingCardBody instructor display", () => {
	it("renders M2M instructors as surname + full first name", () => {
		render(
			<RatingCardBody
				{...baseProps}
				instructors={[
					instructor({
						first_name: "Іван",
						patronymic: "Васильович",
						last_name: "Петренко",
					}),
					instructor({ first_name: "Анна", last_name: "Коваленко" }),
				]}
			/>,
			FF_ON,
		);

		expect(screen.getByText("Викладачі:")).toBeInTheDocument();
		expect(
			screen.getByText("Петренко Іван, Коваленко Анна"),
		).toBeInTheDocument();
	});

	it("uses singular label for a single instructor", () => {
		render(
			<RatingCardBody
				{...baseProps}
				instructors={[
					instructor({ first_name: "Анна", last_name: "Коваленко" }),
				]}
			/>,
			FF_ON,
		);

		expect(screen.getByText("Викладач:")).toBeInTheDocument();
		expect(screen.getByText("Коваленко Анна")).toBeInTheDocument();
	});

	it("falls back to legacy text when no M2M instructors", () => {
		render(<RatingCardBody {...baseProps} instructor="Сегін" />);

		expect(screen.getByText("Викладач:")).toBeInTheDocument();
		expect(screen.getByText("Сегін")).toBeInTheDocument();
	});

	it("prefers M2M over legacy text when both are present", () => {
		render(
			<RatingCardBody
				{...baseProps}
				instructor="Старий текст"
				instructors={[
					instructor({ first_name: "Анна", last_name: "Коваленко" }),
				]}
			/>,
			FF_ON,
		);

		expect(screen.getByText("Коваленко Анна")).toBeInTheDocument();
		expect(screen.queryByText("Старий текст")).not.toBeInTheDocument();
	});

	it("renders no instructor line when neither is provided", () => {
		render(<RatingCardBody {...baseProps} />);

		expect(screen.queryByText(/Викладач/)).not.toBeInTheDocument();
	});

	it("hides M2M instructors and shows legacy text when the flag is off", () => {
		render(
			<RatingCardBody
				{...baseProps}
				instructor="Старий текст"
				instructors={[
					instructor({ first_name: "Анна", last_name: "Коваленко" }),
				]}
			/>,
		);

		expect(screen.queryByText("Коваленко Анна")).not.toBeInTheDocument();
		expect(screen.getByText("Старий текст")).toBeInTheDocument();
	});
});
