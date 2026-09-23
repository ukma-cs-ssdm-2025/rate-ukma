import { describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { CourseAbout, offeringFacts } from "./CourseAbout";
import { CourseCazRecords, recordLabels } from "./CourseCazRecords";
import type { CourseOffering } from "@/lib/api/generated";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/hooks/useMediaQuery", () => ({
	useMediaQuery: () => true,
}));

function offering(over: Partial<CourseOffering> = {}): CourseOffering {
	return {
		id: "offering-1",
		semester_year: 2026,
		semester_term: "Spring",
		code: "900026",
		exam_type: "EXAM",
		instructors: [],
		terms: [
			{
				semester_year: 2026,
				semester_term: "SPRING",
				credits: "5.0",
				weekly_hours: 4,
				total_hours: 150,
				lecture_count: 30,
				practice_count: 30,
			},
		],
		...over,
	};
}

describe("offeringFacts", () => {
	it("returns only the fields the offering carries", () => {
		const facts = offeringFacts(offering());

		expect(facts).toEqual([
			{ label: "Кредити", value: "5 ECTS" },
			{ label: "Годин на тиждень", value: "4 год" },
			{ label: "Лекції", value: "30 год" },
			{ label: "Практичні/семінари", value: "30 год" },
			{ label: "Форма контролю", value: "Іспит" },
		]);
	});

	it("skips missing fields instead of rendering placeholders", () => {
		const facts = offeringFacts(
			offering({
				exam_type: undefined,
				terms: [
					{
						semester_year: 2026,
						semester_term: "SPRING",
						credits: "5.0",
						weekly_hours: 4,
					},
				],
			}),
		);

		expect(facts).toEqual([
			{ label: "Кредити", value: "5 ECTS" },
			{ label: "Годин на тиждень", value: "4 год" },
		]);
	});

	it("maps the credit control form to a Ukrainian label", () => {
		const facts = offeringFacts(
			offering({
				exam_type: "CREDIT",
				terms: [
					{
						semester_year: 2026,
						semester_term: "SPRING",
						credits: "3.0",
						weekly_hours: 2,
					},
				],
			}),
		);

		expect(facts.at(-1)).toEqual({
			label: "Форма контролю",
			value: "Залік",
		});
	});
});

describe("CourseAbout", () => {
	it("renders facts and САЗ rows inline", () => {
		render(
			<CourseAbout
				description="Короткий опис курсу."
				latestOffering={offering()}
				courseOfferings={[offering()]}
			/>,
		);

		expect(
			screen.getByRole("heading", { name: "Про курс" }),
		).toBeInTheDocument();
		expect(screen.getByText("Форма контролю")).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Записи в САЗ" }),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /2025–2026/ })).toBeInTheDocument();
	});

	it("renders nothing for САЗ when the course has no offerings", () => {
		render(
			<CourseAbout
				description={null}
				latestOffering={undefined}
				courseOfferings={[]}
			/>,
		);

		expect(screen.queryByText("Записи в САЗ")).not.toBeInTheDocument();
	});
});

describe("CourseCazRecords", () => {
	const rows = (years: number[]) =>
		years.map((year) =>
			offering({
				id: `offering-${year}`,
				semester_year: year,
			}),
		);

	it("shows the first rows and an inline expand for the rest", () => {
		render(
			<CourseCazRecords
				courseOfferings={rows([2026, 2025, 2024, 2023])}
				initialVisible={2}
			/>,
		);

		expect(screen.getByRole("link", { name: /2025–2026/ })).toBeInTheDocument();
		expect(
			screen.queryByRole("link", { name: /2023–2024/ }),
		).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: "ще 2" })).toBeInTheDocument();
	});

	it("expands every row inline without an overlay", async () => {
		const user = userEvent.setup();
		render(
			<CourseCazRecords
				courseOfferings={rows([2026, 2025, 2024, 2023, 2021])}
				initialVisible={3}
			/>,
		);

		await user.click(screen.getByRole("button", { name: "ще 2" }));

		expect(screen.getByRole("link", { name: /2020–2021/ })).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /^ще \d/ }),
		).not.toBeInTheDocument();
	});

	it("hides the load where it matches the latest offering", () => {
		render(
			<CourseCazRecords
				courseOfferings={[
					offering({ id: "new", semester_year: 2026 }),
					offering({
						id: "old",
						semester_year: 2021,
						terms: [
							{
								semester_year: 2021,
								semester_term: "SPRING",
								credits: "4.0",
								weekly_hours: 3,
							},
						],
					}),
				]}
				initialVisible={5}
			/>,
		);

		expect(screen.getByText("4 ECTS, 3 год")).toBeInTheDocument();
		expect(screen.queryByText("5 ECTS, 4 год")).not.toBeInTheDocument();
	});

	const spec = (title: string) => ({
		speciality_id: title,
		speciality_title: title,
		speciality_alias: "",
	});

	it("folds several САЗ records of one year into one row", async () => {
		const user = userEvent.setup();
		render(
			<CourseCazRecords
				courseOfferings={[
					offering({ id: "a", code: "900001", specialities: [spec("Право")] }),
					offering({
						id: "b",
						code: "900002",
						specialities: [spec("Економіка")],
					}),
				]}
			/>,
		);

		const trigger = screen.getByRole("button", { name: /2 записи/ });
		expect(screen.queryByRole("link")).not.toBeInTheDocument();

		await user.click(trigger);

		expect(screen.getByRole("link", { name: /Право/ })).toHaveAttribute(
			"href",
			"https://my.ukma.edu.ua/course/900001",
		);
		expect(screen.getByRole("link", { name: /Економіка/ })).toHaveAttribute(
			"href",
			"https://my.ukma.edu.ua/course/900002",
		);
	});

	it("labels records by speciality, then by what differs, then by code", () => {
		expect(
			recordLabels([
				offering({ code: "900001", specialities: [spec("Право")] }),
				offering({ code: "900002", specialities: [spec("Право")] }),
				offering({ code: "900003", specialities: [spec("Економіка")] }),
			]),
		).toEqual(["Право, код 900001", "Право, код 900002", "Економіка"]);
		expect(
			recordLabels([
				offering({ study_year: 2, specialities: [spec("Право")] }),
				offering({ study_year: 3, specialities: [spec("Право")] }),
			]),
		).toEqual(["Право, 2 курс", "Право, 3 курс"]);
	});

	it("labels one record spanning two terms with both terms", () => {
		render(
			<CourseCazRecords
				courseOfferings={[
					offering({
						terms: [
							{ semester_year: 2025, semester_term: "FALL", credits: "3.0" },
							{ semester_year: 2026, semester_term: "SPRING", credits: "3.0" },
						],
					}),
				]}
			/>,
		);

		expect(screen.getByText("Осінь, Весна")).toBeInTheDocument();
		expect(screen.getAllByRole("link")).toHaveLength(1);
	});
});
