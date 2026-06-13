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

describe("RatingCardBody instructor display", () => {
	it("renders M2M instructors as surname + initials", () => {
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
		);

		expect(screen.getByText("Викладачі:")).toBeInTheDocument();
		expect(
			screen.getByText("Петренко І. В., Коваленко А."),
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
		);

		expect(screen.getByText("Викладач:")).toBeInTheDocument();
		expect(screen.getByText("Коваленко А.")).toBeInTheDocument();
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
		);

		expect(screen.getByText("Коваленко А.")).toBeInTheDocument();
		expect(screen.queryByText("Старий текст")).not.toBeInTheDocument();
	});

	it("renders no instructor line when neither is provided", () => {
		render(<RatingCardBody {...baseProps} />);

		expect(screen.queryByText(/Викладач/)).not.toBeInTheDocument();
	});
});
