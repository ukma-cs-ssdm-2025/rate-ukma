import { assert, describe, it } from "@effect/vitest";
import { Result } from "effect";
import { parseCoursePage } from "./coursePage.ts";
import {
	coursePage,
	ENROLLMENT,
	label,
	LIMITS,
	row,
} from "./coursePage.fixture.ts";

const parse = (html: string, code = "900123") => parseCoursePage(html, code);

const parsed = (html: string, code = "900123") =>
	Result.getOrThrowWith(parse(html, code), (error) => error);

const failure = (html: string, code = "900123") => {
	const result = parse(html, code);

	assert.isTrue(Result.isFailure(result));

	return Result.isFailure(result) ? result.failure.reason : "";
};

describe("parseCoursePage", () => {
	it("reads the card, its term, programmes, limits and enrollment count", () => {
		assert.deepStrictEqual(parsed(coursePage()), {
			sazCode: "900123",
			title: "Вступ до вигаданих систем",
			credits: 4.5,
			hours: 135,
			studyYear: 2,
			format: "2015",
			status: "held",
			isPractical: false,
			faculty: "Факультет вигаданих наук",
			department: "Кафедра вигаданих систем",
			level: "bachelor",
			academicYear: 2031,
			sazTeachers: null,
			annotation: null,
			programmes: [{ name: "Вигадана інженерія", kind: "compulsory" }],
			terms: [
				{
					season: "FALL",
					semesters: [3],
					credits: 4.5,
					hoursPerWeek: 3,
					lectureHours: 28,
					seminarHours: 14,
					practiceHours: null,
					control: "exam",
				},
			],
			maxStudents: 40,
			maxGroups: null,
			computedMaxStudents: 40,
			groupSizeMin: 15,
			groupSizeMax: 30,
			enrolledActive: 12,
		});
	});

	it("unescapes the title and collapses its whitespace (B16)", () => {
		const offering = parsed(
			coursePage({
				title: "&quot;Вигадані&quot;  системи / Made-up &#039;Systems&#039;",
			}),
		);

		assert.strictEqual(
			offering.title,
			"\"Вигадані\" системи / Made-up 'Systems'",
		);
	});

	it("keeps the teacher row as read (B1)", () => {
		assert.strictEqual(
			parsed(coursePage({ teachers: "Зразок О. П.,  Приклад І. В." }))
				.sazTeachers,
			"Зразок О. П., Приклад І. В.",
		);
	});

	it("reads each status label, and none as unknown (B2)", () => {
		const statusOf = (labels: ReadonlyArray<string>) =>
			parsed(
				coursePage({
					info: [
						label("3 кред."),
						label("90 год."),
						label("1 рік"),
						label("Формат 2015"),
						...labels,
					],
				}),
			).status;

		assert.strictEqual(
			statusOf(['<span class="label label-default">Курс не відбувся</span>']),
			"not_held",
		);
		assert.strictEqual(
			statusOf([label("Курс можливо відбудеться")]),
			"may_hold",
		);
		assert.strictEqual(statusOf([]), "unknown");
	});

	it("reads the practical label and zero credits and hours (B3, B4)", () => {
		const offering = parsed(
			coursePage({
				info: [
					label("0 кред."),
					label("0 год."),
					label("4 рік"),
					label("Формат 2015"),
					'<span class="label label-warning">Практичний</span>',
				],
			}),
		);

		assert.deepStrictEqual(
			[offering.credits, offering.hours, offering.isPractical],
			[0, 0, true],
		);
	});

	it("gives each term the semesters of its season (B6, B8, B9)", () => {
		const terms = parsed(
			coursePage({
				terms: [
					row(
						"Семестри",
						[
							label("Семестр 5"),
							label("Семестр 6"),
							label("Семестр 6д"),
							label("Семестр 7"),
						].join(" "),
					),
					row(
						"Осінь",
						[label("2.0 кред."), label("2 год./тижд."), label("залік")].join(
							"\n",
						),
					),
					row(
						"Весна",
						[
							label("2.0 кред."),
							label("2 год./тижд."),
							label("20 практ."),
							label("теза"),
						].join("\n"),
					),
					row(
						"Літо",
						[
							label("1.5 кред."),
							label("0 год./тижд."),
							label("не має контролю"),
						].join("\n"),
					),
				],
			}),
		).terms;

		assert.deepStrictEqual(
			terms.map(({ season, semesters, credits, practiceHours, control }) => ({
				season,
				semesters,
				credits,
				practiceHours,
				control,
			})),
			[
				{
					season: "FALL",
					semesters: [5, 7],
					credits: 2,
					practiceHours: null,
					control: "pass_fail",
				},
				{
					season: "SPRING",
					semesters: [6],
					credits: 2,
					practiceHours: 20,
					control: "thesis",
				},
				{
					season: "SUMMER",
					semesters: [6],
					credits: 1.5,
					practiceHours: null,
					control: "none",
				},
			],
		);
	});

	it("accepts a card without terms, or a term without semesters (B7)", () => {
		assert.deepStrictEqual(parsed(coursePage({ terms: [] })).terms, []);
		assert.deepStrictEqual(
			parsed(
				coursePage({
					terms: [
						row(
							"Весна",
							[label("3.0 кред."), label("захист дипломної роботи")].join(" "),
						),
					],
				}),
			).terms.map(({ semesters, control }) => ({ semesters, control })),
			[{ semesters: [], control: "thesis_defence" }],
		);
	});

	it("reads an empty control label as no control", () => {
		const [term] = parsed(
			coursePage({
				terms: [
					row("Семестри", label("Семестр 4")),
					row(
						"Весна",
						[label("3.0 кред."), label("0 год./тижд."), label("")].join(" "),
					),
				],
			}),
		).terms;

		assert.strictEqual(term?.control, null);
	});

	it("accepts a card without programmes and collapses a repeated one (B11)", () => {
		assert.deepStrictEqual(
			parsed(coursePage({ programmes: [] })).programmes,
			[],
		);
		assert.deepStrictEqual(
			parsed(
				coursePage({
					programmes: [
						["Вигадана інженерія", "Професійно-орієнтована"],
						["Вигадана інженерія", "Професійно-орієнтована"],
						["Уявна економіка", "Вільного вибору"],
					],
				}),
			).programmes,
			[
				{ name: "Вигадана інженерія", kind: "prof_oriented" },
				{ name: "Уявна економіка", kind: "elective" },
			],
		);
	});

	it("reads unlimited limits as null (B12)", () => {
		const unlimited = '<span class="label label-success">необмежено</span>';

		const offering = parsed(
			coursePage({
				limits: [
					row("Максимальна кількість студентів", unlimited),
					row("Максимальна кількість груп", unlimited),
					row("Кількість студентів в групі", "від 1 до 99"),
					row("Обрахована максимальна кількість студентів", unlimited),
				],
			}),
		);

		assert.deepStrictEqual(
			[offering.maxStudents, offering.maxGroups, offering.computedMaxStudents],
			[null, null, null],
		);
	});

	it("has no enrollment count without the enrollment block (B13)", () => {
		assert.strictEqual(
			parsed(coursePage({ enrollment: [] })).enrolledActive,
			null,
		);
	});

	it("reads the annotation, and none as null (B15)", () => {
		assert.strictEqual(
			parsed(
				coursePage({
					annotation:
						"\t\tКурс про &quot;вигадані&quot; системи.\nДругий рядок.\n",
				}),
			).annotation,
			'Курс про "вигадані" системи.\nДругий рядок.',
		);
		assert.strictEqual(
			parsed(coursePage({ annotation: "  " })).annotation,
			null,
		);
	});

	it("reads a master's card without faculty and department rows (B18)", () => {
		const offering = parsed(coursePage({ level: "Магістр", unit: [] }));

		assert.deepStrictEqual(
			[offering.level, offering.faculty, offering.department],
			["master", null, null],
		);
	});

	it("skips a label САЗ commented out", () => {
		const page = coursePage().replace(
			label("4.5 кред.", "4.5 кредитів"),
			`$&\n<!--\n${label("5 кред.")}\n-->`,
		);

		assert.strictEqual(parsed(page).credits, 4.5);
	});

	it("fails a page whose labels or rows it does not know", () => {
		assert.strictEqual(
			failure(coursePage({ info: [label("4 кред."), label("Новий ярлик")] })),
			"unknown label",
		);
		assert.strictEqual(
			failure(
				coursePage({
					terms: [row("Осінь", [label("3 кред."), label("3 кред.")].join(" "))],
				}),
			),
			"repeated label",
		);
		assert.strictEqual(
			failure(coursePage({ terms: [row("Семестри", label("Триместр 1"))] })),
			"invalid semesters",
		);
		assert.strictEqual(
			failure(coursePage({ level: "Доктор" })),
			"invalid level",
		);
		assert.strictEqual(
			failure(coursePage({ year: "2031" })),
			"invalid academicYear",
		);
		assert.strictEqual(
			failure(coursePage({ limits: LIMITS.slice(1) })),
			"invalid maxStudents",
		);
	});

	it("fails an empty number instead of reading it as 0", () => {
		assert.strictEqual(
			failure(coursePage({ terms: [row("Осінь", label("залік"))] })),
			"invalid terms",
		);
		assert.strictEqual(
			failure(
				coursePage({
					limits: [
						row("Максимальна кількість студентів", ""),
						...LIMITS.slice(1),
					],
				}),
			),
			"invalid maxStudents",
		);
	});

	it("keeps an entity past the last code point as written", () => {
		assert.strictEqual(
			parsed(coursePage({ title: "Системи &#99999999; &#0; &#xD800;" })).title,
			"Системи &#99999999; &#0; &#xD800;",
		);
	});

	it("fails a page with a row it does not know", () => {
		const renamed = coursePage({ teachers: "Зразок О. П." }).replace(
			"<th>Викладач</th>",
			"<th>Викладачі</th>",
		);

		assert.strictEqual(failure(renamed), "unknown row");
		assert.strictEqual(
			failure(
				coursePage().replace("<th>Освітній рівень</th>", "<th>Рівень</th>"),
			),
			"unknown row",
		);
		assert.strictEqual(
			failure(coursePage({ annotation: "Текст" }).replace("--info", "--about")),
			"unknown block",
		);
	});

	it("fails an enrollment block without its count, and an annotation with markup", () => {
		assert.strictEqual(
			failure(coursePage({ enrollment: ENROLLMENT.slice(1) })),
			"invalid enrolledActive",
		);
		assert.strictEqual(
			failure(coursePage({ annotation: "<div>Перший абзац.</div> Другий." })),
			"annotation markup",
		);
	});

	it("fails credits the column cannot hold", () => {
		assert.strictEqual(
			failure(
				coursePage({
					info: [
						label("1000 кред."),
						label("90 год."),
						label("1 рік"),
						label("Формат 2015"),
					],
				}),
			),
			"invalid credits",
		);
	});

	it("keeps term credits that differ from the card's (B5)", () => {
		const offering = parsed(
			coursePage({
				terms: [
					row("Семестри", label("Семестр 1")),
					row("Осінь", [label("2.0 кред."), label("залік")].join(" ")),
				],
			}),
		);

		assert.deepStrictEqual(
			[offering.credits, offering.terms[0]?.credits],
			[4.5, 2],
		);
	});

	it("stores an empty teacher cell as null", () => {
		assert.strictEqual(parsed(coursePage({ teachers: " " })).sazTeachers, null);
	});

	it("fails a page that is not the card of its code", () => {
		assert.strictEqual(failure(coursePage(), "900124"), "code mismatch");
		assert.strictEqual(
			failure("<html><body>Увійдіть</body></html>"),
			"no course card",
		);
		assert.strictEqual(
			failure(coursePage().replace("<small>", "<span>")),
			"no title",
		);
	});
});
