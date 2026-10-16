export const label = (text: string, title = "") =>
	`<span class="label label-default"${title === "" ? "" : ` title="${title}"`}>${text}</span>`;

export const row = (header: string, cell: string) =>
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

export const LIMITS = [
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
export const coursePage = ({
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
