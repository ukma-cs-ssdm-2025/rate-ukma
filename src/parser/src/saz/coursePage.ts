import { Result, Schema, SchemaTransformation } from "effect";
import { textOf, unescapeHtml } from "./html.ts";

const decodeWith = <T, E>(decode: (input: E) => T, encode: (input: T) => E) =>
	SchemaTransformation.transform({ decode, encode });

/** Digits only: `FiniteFromString` alone reads an empty cell as 0. */
const Amount = Schema.String.check(Schema.isPattern(/^\d+(?:\.\d+)?$/u)).pipe(
	Schema.decodeTo(Schema.Finite, SchemaTransformation.numberFromString),
);

const Count = Amount.check(Schema.isInt());

/** `необмежено` is no limit. */
const Limit = Schema.Union([
	Schema.Literal("необмежено").pipe(
		Schema.decodeTo(
			Schema.Null,
			decodeWith(
				() => null,
				() => "необмежено" as const,
			),
		),
	),
	Count,
]);

const AcademicYear = Schema.String.check(
	Schema.isPattern(/^\d{4}–\d{4}$/u),
).pipe(
	Schema.decodeTo(
		Schema.Int,
		decodeWith(
			(years) => Number(years.slice(0, 4)),
			(year) => `${year}–${year + 1}`,
		),
	),
);

/** `Семестр 6д` is the summer after semester 6. */
const Semester = Schema.String.check(Schema.isPattern(/^Семестр \d+д?$/u)).pipe(
	Schema.decodeTo(
		Schema.Struct({ number: Schema.Int, summer: Schema.Boolean }),
		decodeWith(
			(label) => ({
				number: Number.parseInt(label.slice("Семестр ".length), 10),
				summer: label.endsWith("д"),
			}),
			({ number, summer }) => `Семестр ${number}${summer ? "д" : ""}`,
		),
	),
);

export const Level = Schema.Literals(["Бакалавр", "Магістр"]).transform([
	"bachelor",
	"master",
]);

/** An empty label is a card without a status. */
const Status = Schema.Literals([
	"Курс відбувся",
	"Курс не відбувся",
	"Курс можливо відбудеться",
	"",
]).transform(["held", "not_held", "may_hold", "unknown"]);

const Season = Schema.Literals(["Осінь", "Весна", "Літо"]).transform([
	"FALL",
	"SPRING",
	"SUMMER",
]);

const Control = Schema.Literals([
	"залік",
	"екзамен",
	"теза",
	"не має контролю",
	"захист дипломної роботи",
]).transform(["pass_fail", "exam", "thesis", "none", "thesis_defence"]);

const ProgrammeKind = Schema.Literals([
	"Обов`язкова",
	"Професійно-орієнтована",
	"Вільного вибору",
]).transform(["compulsory", "prof_oriented", "elective"]);

const CardTerm = Schema.Struct({
	season: Season,
	credits: Amount,
	hoursPerWeek: Schema.NullOr(Count),
	lectureHours: Schema.NullOr(Count),
	seminarHours: Schema.NullOr(Count),
	practiceHours: Schema.NullOr(Count),
	control: Schema.NullOr(Control),
});

/** A course card as the page shows it, decoded from the text of its cells
 *  and labels. A missing row the card always has is a missing key. */
const CourseCard = Schema.Struct({
	code: Schema.String,
	title: Schema.NonEmptyString,
	credits: Amount,
	hours: Count,
	studyYear: Count,
	format: Schema.String,
	status: Status,
	isPractical: Schema.Boolean,
	faculty: Schema.NullOr(Schema.NonEmptyString),
	department: Schema.NullOr(Schema.NonEmptyString),
	level: Level,
	academicYear: AcademicYear,
	sazTeachers: Schema.NullOr(Schema.String),
	annotation: Schema.NullOr(Schema.String),
	programmes: Schema.Array(
		Schema.Struct({ name: Schema.NonEmptyString, kind: ProgrammeKind }),
	),
	semesters: Schema.Array(Semester),
	terms: Schema.Array(CardTerm),
	maxStudents: Limit,
	maxGroups: Limit,
	computedMaxStudents: Limit,
	groupSizeMin: Count,
	groupSizeMax: Count,
	enrolledActive: Schema.NullOr(Count),
});

type CourseCard = typeof CourseCard.Type;

/** `T` before decoding: any text where `T` has a vocabulary, and any key may be
 *  missing, so `CourseCard` reports a row the page lacks as a missing key. */
type Unchecked<T> = T extends string
	? string
	: T extends ReadonlyArray<infer Item>
		? ReadonlyArray<Unchecked<Item>>
		: T extends object
			? { readonly [K in keyof T]?: Unchecked<T[K]> }
			: T;

type RawCard = Unchecked<typeof CourseCard.Encoded>;

export type Season = typeof Season.Type;

export type OfferingTerm = Omit<CourseCard["terms"][number], "season"> & {
	readonly season: Season;
	readonly semesters: ReadonlyArray<number>;
};

export type ParsedOffering = Omit<
	CourseCard,
	"code" | "semesters" | "terms"
> & {
	readonly sazCode: string;
	readonly terms: ReadonlyArray<OfferingTerm>;
};

/** Why a course page did not parse; `reason` is short and stable, so
 *  failures can be counted by it. */
export class CoursePageError extends Schema.TaggedError<CoursePageError>()(
	"CoursePageError",
	{ reason: Schema.String, detail: Schema.String },
) {}

const TITLE = /<h1>(.*?)<small>/su;

const CARD_START = '<div id="w0">';

const ANNOTATION =
	/<div class="collapse text-justify" id="course-card--\d+--info">(.*?)<\/div>/su;

const PROGRAMMES =
	/<div class="collapse text-justify" id="course-card--\d+--spec">(.*?)<\/div>/su;

const ROW = /<tr[^>]*>(.*?)<\/tr>/gsu;

const HEADER_CELL = /<th[^>]*>(.*?)<\/th>/su;

const CELL = /<td[^>]*>(.*?)<\/td>/gsu;

const LABEL = /<span class="label[^"]*"[^>]*>(.*?)<\/span>/gsu;

const SEASONS = new Set(["Осінь", "Весна", "Літо"]);

type LabelPatterns<K extends string> = ReadonlyArray<readonly [RegExp, K]>;

const INFO_LABELS: LabelPatterns<
	"credits" | "hours" | "studyYear" | "format" | "status" | "practical"
> = [
	[/^(\d+(?:\.\d+)?) кред\.$/u, "credits"],
	[/^(\d+) год\.$/u, "hours"],
	[/^(\d+) рік$/u, "studyYear"],
	[/^Формат (\S+)$/u, "format"],
	[/^(Курс .+)$/u, "status"],
	[/^(Практичний)$/u, "practical"],
];

/** Every label that is not an amount is the term's control. */
const TERM_LABELS: LabelPatterns<
	| "credits"
	| "hoursPerWeek"
	| "lectureHours"
	| "seminarHours"
	| "practiceHours"
	| "control"
> = [
	[/^(\d+(?:\.\d+)?) кред\.$/u, "credits"],
	[/^(\d+) год\.\/тижд\.$/u, "hoursPerWeek"],
	[/^(\d+) лекц\.$/u, "lectureHours"],
	[/^(\d+) сем\.$/u, "seminarHours"],
	[/^(\d+) практ\.$/u, "practiceHours"],
	[/^(.+)$/u, "control"],
];

const GROUP_SIZE = /^від (\d+) до (\d+)$/u;

const labelsOf = (cell: string): ReadonlyArray<string> =>
	Array.from(cell.matchAll(LABEL), ([, label]) => textOf(label ?? "")).filter(
		(label) => label !== "",
	);

/** The value each label gives, keyed by the pattern it matches. A label that
 *  matches nothing or repeats a key fails the page. */
const readLabels = <K extends string>(
	labels: ReadonlyArray<string>,
	patterns: LabelPatterns<K>,
): Result.Result<Map<K, string>, CoursePageError> => {
	const values = new Map<K, string>();

	for (const label of labels) {
		const match = patterns.find(([pattern]) => pattern.test(label));

		if (match === undefined) {
			return Result.fail(
				new CoursePageError({ reason: "unknown label", detail: label }),
			);
		}

		const [pattern, key] = match;

		if (values.has(key)) {
			return Result.fail(
				new CoursePageError({ reason: "repeated label", detail: label }),
			);
		}

		values.set(key, pattern.exec(label)?.[1] ?? "");
	}

	return Result.succeed(values);
};

/** The card's rows by their header text; the first of two equal headers wins
 *  (`Кількість затверджених груп` appears twice). */
const rowsOf = (card: string): Map<string, string> => {
	const rows = new Map<string, string>();

	for (const [, row = ""] of card.matchAll(ROW)) {
		const header = HEADER_CELL.exec(row);
		const [cell] = Array.from(row.matchAll(CELL), ([, value]) => value ?? "");

		if (header === null || cell === undefined) continue;

		const name = textOf(header[1] ?? "");

		if (!rows.has(name)) rows.set(name, cell);
	}

	return rows;
};

const programmesOf = (block: string | undefined): RawCard["programmes"] =>
	Array.from(block?.matchAll(ROW) ?? [], ([, row = ""]) => {
		const [name = "", kind = ""] = Array.from(row.matchAll(CELL), ([, cell]) =>
			textOf(cell ?? ""),
		);

		return { name, kind };
	});

/** Reads the card of a stored course page into strings, ready for
 *  `CourseCard` to decode. */
const readCard = (html: string): Result.Result<RawCard, CoursePageError> =>
	Result.gen(function* () {
		const start = html.indexOf(CARD_START);
		const title = TITLE.exec(html)?.[1];
		const page = html.slice(start);
		const annotation = ANNOTATION.exec(page)?.[1];
		const programmes = PROGRAMMES.exec(page)?.[1];

		// The programmes block holds a table of its own, so the card ends at the
		// first table end only once both blocks are cut out.
		const card = page.replace(ANNOTATION, "").replace(PROGRAMMES, "");
		const end = card.indexOf("</table>");

		if (start === -1 || title === undefined || end === -1) {
			return yield* Result.fail(
				new CoursePageError({ reason: "no course card", detail: "" }),
			);
		}

		const rows = rowsOf(card.slice(0, end));

		const text = (name: string) => {
			const cell = rows.get(name);

			return cell === undefined ? undefined : textOf(cell);
		};

		const info = yield* readLabels(
			labelsOf(rows.get("Інформація") ?? ""),
			INFO_LABELS,
		);

		const terms: Array<Unchecked<(typeof CardTerm)["Encoded"]>> = [];

		for (const [season, cell] of rows) {
			if (!SEASONS.has(season)) continue;

			const labels = yield* readLabels(labelsOf(cell), TERM_LABELS);

			terms.push({
				season,
				credits: labels.get("credits"),
				hoursPerWeek: labels.get("hoursPerWeek") ?? null,
				lectureHours: labels.get("lectureHours") ?? null,
				seminarHours: labels.get("seminarHours") ?? null,
				practiceHours: labels.get("practiceHours") ?? null,
				control: labels.get("control") ?? null,
			});
		}

		const groupSize = GROUP_SIZE.exec(
			text("Кількість студентів в групі") ?? "",
		);

		const annotationText = unescapeHtml(annotation ?? "").trim();

		return {
			code: text("Код"),
			title: textOf(title),
			credits: info.get("credits"),
			hours: info.get("hours"),
			studyYear: info.get("studyYear"),
			format: info.get("format"),
			status: info.get("status") ?? "",
			isPractical: info.has("practical"),
			faculty: text("Факультет") ?? null,
			department: text("Кафедра") ?? null,
			level: text("Освітній рівень"),
			academicYear: text("Навчальний рік"),
			sazTeachers: text("Викладач") ?? null,
			annotation: annotationText === "" ? null : annotationText,
			programmes: programmesOf(programmes),
			semesters: labelsOf(rows.get("Семестри") ?? ""),
			terms,
			maxStudents: text("Максимальна кількість студентів"),
			maxGroups: text("Максимальна кількість груп"),
			computedMaxStudents: text("Обрахована максимальна кількість студентів"),
			groupSizeMin: groupSize?.[1],
			groupSizeMax: groupSize?.[2],
			enrolledActive:
				text("Загальна кількість записаних чинних студентів") ?? null,
		};
	});

const isOfSeason = (
	{ number, summer }: CourseCard["semesters"][number],
	season: Season,
): boolean =>
	season === "SUMMER"
		? summer
		: !summer && (number % 2 === 1) === (season === "FALL");

/** Each term gets the semesters of its season: odd ones are fall, even ones
 *  spring and `Nд` summer. A programme listed twice is kept once. */
const offeringOf = ({
	code,
	semesters,
	terms,
	programmes,
	...card
}: CourseCard): ParsedOffering => ({
	...card,
	sazCode: code,
	programmes: [
		...new Map(
			programmes.map((programme) => [programme.name, programme]),
		).values(),
	],
	terms: terms.map((term) => ({
		...term,
		semesters: semesters
			.filter((semester) => isOfSeason(semester, term.season))
			.map(({ number }) => number),
	})),
});

const decodeCard = Schema.decodeUnknownResult(CourseCard);

/** The card field a decoding issue points at, as in `at ["level"]`. */
const ISSUE_FIELD = /at \["(\w+)"\]/u;

/** Parses the stored page of `/course/<code>` into an offering. */
export const parseCoursePage = (
	html: string,
	code: string,
): Result.Result<ParsedOffering, CoursePageError> =>
	Result.gen(function* () {
		const card = yield* readCard(html).pipe(
			Result.flatMap((raw) =>
				decodeCard(raw).pipe(
					Result.mapError(
						(error) =>
							new CoursePageError({
								reason: `invalid ${ISSUE_FIELD.exec(error.message)?.[1] ?? "card"}`,
								detail: error.message,
							}),
					),
				),
			),
		);

		if (card.code !== code) {
			return yield* Result.fail(
				new CoursePageError({ reason: "code mismatch", detail: card.code }),
			);
		}

		return offeringOf(card);
	});
