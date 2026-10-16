import { assert, describe, it } from "@effect/vitest";
import { Result } from "effect";
import { parseCoursePage } from "./coursePage.ts";

const label = (text: string, title = "") =>
	`<span class="label label-default"${title === "" ? "" : ` title="${title}"`}>${text}</span>`;

const row = (header: string, cell: string) =>
	`<tr>\n\t<th>${header}</th>\n\t<td>\n\t\t${cell}\n\t</td>\n</tr>`;

const section = (name: string, rows: ReadonlyArray<string>) =>
	`<tbody>\n<tr><th colspan="2" class="info text-center">${name}</th></tr>\n${rows.join("\n")}\n</tbody>`;

interface PageParts {
	readonly code?: string;
	readonly title?: string;
	readonly info?: ReadonlyArray<string>;
	readonly unit?: ReadonlyArray<string>;
	readonly level?: string;
	readonly year?: string;
	readonly teachers?: string;
	readonly annotation?: string;
	readonly programmes?: ReadonlyArray<readonly [string, string]>;
	readonly terms?: ReadonlyArray<string>;
	readonly limits?: ReadonlyArray<string>;
	readonly enrollment?: ReadonlyArray<string>;
}

const FACULTY_ROWS = [
	`<tr><th><abbr title="Факультет, який забезпечує викладання дисципліни">Факультет</abbr></th><td>Факультет вигаданих наук</td></tr>`,
	`<tr><th><abbr title="Кафедра, яка забезпечує викладання дисципліни">Кафедра</abbr></th><td>Кафедра вигаданих систем</td></tr>`,
];

const LIMITS = [
	row("Максимальна кількість студентів", "40"),
	row(
		"Максимальна кількість груп",
		'<span class="label label-success">необмежено</span>',
	),
	row("Кількість студентів в групі", "від\n\t\t15\n\t\tдо\n\t\t30"),
	row(
		"Обрахована максимальна кількість студентів",
		'40\n<!--\n<span class="label label-success">необмежено</span>\n-->',
	),
];

const ENROLLMENT = [
	row("Загальна кількість записаних чинних студентів", "12"),
	row("Кількість затверджених груп", "1"),
	row("Кількість чинних студентів у затверджених групах", "12"),
	row("Кількість затверджених груп", "1"),
];

/** An invented course page shaped like a САЗ card. */
const coursePage = ({
	code = "900123",
	title = "Вступ до вигаданих систем",
	info = [
		label("4.5 кред.", "4.5 кредитів"),
		label("135 год.", "135 годин"),
		label("2 рік", "2 рік викладання"),
		label("Формат 2015", "Формат 2015"),
		'<span class="label label-success">Курс відбувся</span>',
	],
	unit = FACULTY_ROWS,
	level = "Бакалавр",
	year = "2031–2032",
	teachers,
	annotation,
	programmes = [["Вигадана інженерія", "Обов`язкова"]],
	terms = [
		row("Семестри", label("Семестр 3")),
		row(
			"Осінь",
			[
				label("4.5 кред.", "4.5 кредитів"),
				label("3 год./тижд.", "3 годин на тиждень"),
				label("28 лекц.", "28 годин на тиждень"),
				label("14 сем.", "14 годин на тиждень"),
				label("екзамен"),
			].join("\n"),
		),
	],
	limits = LIMITS,
	enrollment = ENROLLMENT,
}: PageParts = {}) => `<!DOCTYPE html>
<html><body>
<nav><a href="/profile">Вигаданий Користувач</a></nav>
<div class="page-header">
	<h1>
		${title}		<small>Перегляд деталей курсу</small>
	</h1>
</div>
<div id="w0">
<table class="table table-condensed table-bordered">
	<tr><th title="Код курсу">Код</th><td>${code}</td></tr>
	${row("Інформація", info.join("\n"))}
	${unit.join("\n")}
	<tr><th>Освітній рівень</th><td>${level}</td></tr>
	<tr><th>Навчальний рік</th><td>${year}</td></tr>
	${teachers === undefined ? "" : `<tr><th>Викладач</th><td>${teachers}</td></tr>`}
	${
		annotation === undefined
			? ""
			: `<tr><td colspan="2"><div class="collapse text-justify" id="course-card--${code}--info">\n${annotation}\n</div></td></tr>`
	}
	${
		programmes.length === 0
			? ""
			: `<tr><td colspan="2"><div class="collapse text-justify" id="course-card--${code}--spec">
<table class="table table-bordered table-condensed">
${programmes.map(([name, kind]) => `<tr><td>${name}</td><td>${label(kind)}</td></tr>`).join("\n")}
</table>
</div></td></tr>`
	}
	${terms.length === 0 ? "" : section("Деталі по семестрах", terms)}
	${section("Встановлені ліміти", limits)}
	${enrollment.length === 0 ? "" : section("Інформація про запис", enrollment)}
</table>
<course-enrollment :course-id="${code}" autoload></course-enrollment>
</div>
</body></html>`;

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

	it("reads a master's card without faculty and department rows (B17)", () => {
		const offering = parsed(coursePage({ level: "Магістр", unit: [] }));

		assert.deepStrictEqual(
			[offering.level, offering.faculty, offering.department],
			["master", null, null],
		);
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
			parsed(coursePage({ title: "Системи &#99999999;" })).title,
			"Системи &#99999999;",
		);
	});

	it("fails a page that is not the card of its code", () => {
		assert.strictEqual(failure(coursePage(), "900124"), "code mismatch");
		assert.strictEqual(
			failure("<html><body>Увійдіть</body></html>"),
			"no course card",
		);
	});
});
