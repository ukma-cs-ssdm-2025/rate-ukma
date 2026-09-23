import { describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { CourseAbout, offeringFacts } from "./CourseAbout";
import { CourseCazRecords } from "./CourseCazRecords";
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
			{ label: "Всього годин", value: "150 год" },
			{ label: "Лекції", value: "30" },
			{ label: "Практики", value: "30" },
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
	it("renders facts, instructors, and САЗ rows inline", () => {
		render(
			<CourseAbout
				description="Короткий опис курсу."
				latestOffering={offering({
					instructors: [
						{
							id: "i-1",
							first_name: "Олена",
							patronymic: "Петрівна",
							last_name: "Демченко",
						},
					],
				})}
				courseOfferings={[offering()]}
			/>,
		);

		expect(
			screen.getByRole("heading", { name: "Про курс" }),
		).toBeInTheDocument();
		expect(screen.getByText("Форма контролю")).toBeInTheDocument();
		expect(screen.getByText("Демченко Олена Петрівна")).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Записи в САЗ" }),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /2025–2026/ })).toBeInTheDocument();
	});

	it("never renders an empty instructor placeholder", () => {
		render(
			<CourseAbout
				description={null}
				latestOffering={offering({ instructors: [] })}
				courseOfferings={[]}
			/>,
		);

		expect(screen.queryByText(/Викладачі/)).not.toBeInTheDocument();
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

		expect(
			screen.getByRole("link", { name: /2025–2026/ }),
		).toBeInTheDocument();
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

		expect(
			screen.getByRole("link", { name: /2020–2021/ }),
		).toBeInTheDocument();
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

	it("shows a row's instructors only when they differ from the latest", () => {
		const demchenko = {
			id: "i-1",
			first_name: "Олена",
			patronymic: "Петрівна",
			last_name: "Демченко",
		};
		const kovalenko = {
			id: "i-2",
			first_name: "Анна",
			last_name: "Коваленко",
		};
		render(
			<CourseCazRecords
				courseOfferings={[
					offering({ id: "new", semester_year: 2026, instructors: [demchenko] }),
					offering({
						id: "same",
						semester_year: 2025,
						instructors: [demchenko],
					}),
					offering({
						id: "changed",
						semester_year: 2024,
						instructors: [kovalenko],
					}),
				]}
				initialVisible={5}
			/>,
		);

		expect(screen.getByText("Коваленко Анна")).toBeInTheDocument();
		expect(screen.queryByText("Демченко Олена Петрівна")).not.toBeInTheDocument();
	});
});
