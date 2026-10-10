import { Schema } from "effect";
import type { Offering } from "./offering.ts";
import type { DisciplineId, GroupLabel } from "./schedule.ts";
import type { RegisteredGroups } from "./selection.ts";

/** One ІНП line as САЗ prints it (course id + printed title). */
export const InpEntry = Schema.Struct({
	courseId: Schema.String,
	/** The title exactly as САЗ prints it in the ІНП. */
	title: Schema.String,
	/** Parsed-schedule name, when it differs from the САЗ title. */
	match: Schema.optional(Schema.String),
	/** Which sheet's variant this student attends, when sheets disagree. */
	variantLabel: Schema.optional(Schema.String),
});
export interface InpEntry extends Schema.Schema.Type<typeof InpEntry> {}

/** САЗ and the sheets disagree on apostrophes (` ’ '), and sheets glue the
 *  teacher onto the discipline cell when the teacher column is merged:
 *  «, доц. Прізвище І.А», «,проф. Прізвище», «/ ст.викл. Прізвище», or just
 *  «, доц.». Everything from the first rank word to the end is the teacher. */
const RANK_WORD =
	/(?:^|[\s,/])(?:проф|доц|ст\.?\s*в(?:ик(?:л(?:адач)?)?)?|викл(?:адач)?|ас(?:ист|ис)?|вакансія)(?=$|[.\s,/]|(?<=викладач)\p{Lu})/giu;
const DEGREE_GARBAGE = /(?:[,;]\s*|\s+)(?:[а-яіїє]\.\s?){1,3}н\.\s*$/i;

export const canonName = (value: string): string => {
	const plain = value.replace(/[`’ʼ]/g, "'");
	// «(за проф. спрямуванням)» is a tag, not a teacher: cut at the first rank
	// word that is not inside parentheses.
	let cut = plain;
	for (const hit of plain.matchAll(RANK_WORD)) {
		const head = plain.slice(0, hit.index);
		if ((head.match(/\(/g) ?? []).length === (head.match(/\)/g) ?? []).length) {
			cut = head;
			break;
		}
	}
	return cut
		.replace(DEGREE_GARBAGE, "")
		.replace(/[\s,/]+$/u, "")
		.trim()
		.replace(/\s+/g, " ");
};

/** The discipline name without a « · variant» suffix. */
export const baseName = (discipline: string): string =>
	canonName(discipline.split(" · ")[0]!);

/**
 * Sheet cells truncate long names («…забезпеченн»); the ІНП title completes
 * them. It is used only as a completion — where the two genuinely differ
 * (САЗ's ІНП has its own typos), the published sheet name wins.
 */
export const displayNameOf = (
	parsed: string,
	inpTitle: string | undefined,
): string => {
	const [base, ...rest] = parsed.split(" · ");
	const suffix = rest.length > 0 ? ` · ${rest.join(" · ")}` : "";
	if (
		inpTitle &&
		inpTitle.length > base!.length &&
		inpTitle.startsWith(base!)
	) {
		return `${inpTitle}${suffix}`;
	}
	return parsed;
};

// Roman numerals in Latin or Cyrillic letters ("II", "ІІ") and the digit they
// mean; sheets and САЗ pick any of the three for the same course.
// \b is ASCII-only, so the boundary is spelled out for Cyrillic letters.
const NUMERAL = /(?<![\p{L}\d])[IiІі]{1,3}(?![\p{L}\d])/gu;
const PARENTHETICAL = /\s*\([^)]*\)/g;

/**
 * The comparison key for an ІНП title and a sheet name. САЗ and the sheets
 * disagree on nothing that changes meaning: dash vs space ("бізнес-аналізу",
 * "бізнес аналізу"), spaces around dashes and slashes ("Digital - маркетинг",
 * "Digital – маркетинг"), Roman vs Arabic numerals, a trailing period, case.
 * Two distinct disciplines never differ by only these, so the key folds them.
 */
export const matchKey = (value: string): string =>
	canonName(value)
		.toLowerCase()
		.replace(NUMERAL, (numeral) => String(numeral.length))
		.replace(/\s*[-–—]\s*/g, " ")
		.replace(/\s*\/\s*/g, "/")
		.replace(/\.+$/, "")
		.trim()
		.replace(/\s+/g, " ");

// Every ІНП line is compared with every offering in up to four passes, so a
// real semester (thousands of offerings) would rerun the regexes above
// tens of thousands of times per resolve. The key depends on the name alone.
const disciplineKeys = new Map<string, string>();
const disciplineKey = (discipline: string): string => {
	let key = disciplineKeys.get(discipline);
	if (key === undefined) {
		key = matchKey(baseName(discipline));
		disciplineKeys.set(discipline, key);
	}
	return key;
};

/** Offerings whose (base) name carries the ІНП entry, variants preferred by label. */
export const matchOfferings = (
	offerings: ReadonlyArray<Offering>,
	entry: InpEntry,
): ReadonlyArray<Offering> => {
	const wanted = matchKey(entry.match ?? entry.title);
	const exact = offerings.filter(
		(offering) => disciplineKey(offering.discipline) === wanted,
	);
	const chooseVariant = (
		hits: ReadonlyArray<Offering>,
	): ReadonlyArray<Offering> => {
		if (hits.length > 1 && entry.variantLabel) {
			const label = canonName(entry.variantLabel);
			const preferred = hits.filter((offering) =>
				canonName(offering.discipline).endsWith(label),
			);
			if (preferred.length > 0) return preferred;
		}
		return hits;
	};
	if (exact.length > 0) return chooseVariant(exact);
	// A sheet cell cut off mid-word («…програмного забезпеченн») is completed
	// by the ІНП title. Only mid-word: «Психологія» is a whole name, not a
	// truncated «Психологія впливу», and an ІНП «Менеджмент» never means
	// «Менеджмент впливу». Stubs like «Ро.» are too short to mean anything.
	const truncated = offerings.filter((offering) => {
		const have = disciplineKey(offering.discipline);
		return (
			have.length >= MIN_STUB &&
			wanted.length > have.length &&
			wanted.startsWith(have) &&
			WORD.test(wanted[have.length]!)
		);
	});
	if (truncated.length > 0) return chooseVariant(truncated);
	// The two sides tag the course differently in parentheses — САЗ
	// "(англ. мовою)" or "(закінчення вивчення)", the sheet "(фін.)" — so
	// compare with every parenthetical gone. Where both sides carry a
	// qualifier that names a thing («(французька мова)» vs «(французька)»,
	// «(економіка)» vs «(економ)») it must agree. Variants still pick by label.
	const bare = wanted.replace(PARENTHETICAL, "");
	if (bare !== "") {
		const untagged = offerings.filter(
			(offering) =>
				disciplineKey(offering.discipline).replace(PARENTHETICAL, "") === bare,
		);
		const wantedTags = qualifiers(wanted);
		const agreeing =
			wantedTags.length === 0
				? untagged
				: untagged.filter((offering) => {
						const tags = qualifiers(disciplineKey(offering.discipline));
						return (
							tags.length === 0 ||
							tags.some((tag) =>
								wantedTags.some((want) => sameQualifier(tag, want)),
							)
						);
					});
		if (agreeing.length > 0) return chooseVariant(agreeing);
	}
	return chooseVariant(typoMatch(offerings, wanted));
};

const MIN_STUB = 5;
const WORD = /[\p{L}\p{N}]/u;

/** Words inside parentheses that name a thing (a language, a programme),
 *  minus filler: «(французька мова)» is «французька», «(англ. мовою)» is
 *  nothing, «(фін+мар)» is «фін» and «мар». */
const QUALIFIER_FILLER = new Set([
	"мова",
	"мовою",
	"англ",
	"для",
	"оп",
	"опп",
	"з",
	"та",
	"і",
]);
const qualifiers = (key: string): ReadonlyArray<string> =>
	[...key.matchAll(/\(([^)]*)\)/g)]
		.flatMap((hit) => hit[1]!.split(/[^\p{L}]+/u))
		.filter((word) => word.length >= 3 && !QUALIFIER_FILLER.has(word));

/** «економ» and «економіка», «марк» and «маркетинг»: one is a prefix of the
 *  other and the shorter is at least three letters. */
const sameQualifier = (a: string, b: string): boolean =>
	a === b ||
	(a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a)));

/** Levenshtein distance, cut off once it exceeds `limit`. */
const editDistance = (a: string, b: string, limit: number): number => {
	if (Math.abs(a.length - b.length) > limit) return limit + 1;
	let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		const current = [i];
		let best = i;
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			const value = Math.min(
				previous[j]! + 1,
				current[j - 1]! + 1,
				previous[j - 1]! + cost,
			);
			current.push(value);
			if (value < best) best = value;
		}
		if (best > limit) return limit + 1;
		previous = current;
	}
	return previous[b.length]!;
};

const DIGITS = /\d+/g;

/** One edit per twenty characters, at most two: «Мікроекономіка» is one edit
 *  from «Макроекономіка», so a short name gets no budget at all. */
const typoBudget = (title: string): number =>
	Math.min(2, Math.floor(title.length / 20));

/**
 * САЗ's ІНП has its own typos («пограмування» for «програмування»); the sheet
 * spells the course right. A single sheet name within the title's edit budget
 * and agreeing on every number («Історія соціології-1» is never «Історія
 * соціології-2») is that course. Two candidates is ambiguity, not a match
 * (ADR 0001).
 */
const typoMatch = (
	offerings: ReadonlyArray<Offering>,
	wanted: string,
): ReadonlyArray<Offering> => {
	const budget = typoBudget(wanted);
	if (budget === 0) return [];
	const numbers = (wanted.match(DIGITS) ?? []).join(",");
	const byBase = new Map<string, Array<Offering>>();
	for (const offering of offerings) {
		const key = disciplineKey(offering.discipline);
		if ((key.match(DIGITS) ?? []).join(",") !== numbers) continue;
		if (editDistance(wanted, key, budget) > budget) continue;
		const bucket = byBase.get(key);
		if (bucket) bucket.push(offering);
		else byBase.set(key, [offering]);
	}
	if (byBase.size !== 1) return [];
	return [...byBase.values()][0]!;
};
/** The student's programme as САЗ rosters print it: the sheet «Комп'ютерні
 *  науки БП-4» is the student with `name` «Комп'ютерні науки», `grade` 4. */
export interface Programme {
	readonly name: string;
	readonly grade: number;
}

export const sheetLabelOf = (programme: Programme): string =>
	`${programme.name} БП-${programme.grade}`;

/** Why a line landed on this offering, in words the student can check. */
export type PickBasis =
	/** The only published match. */
	| "only"
	/** The version in the student's own sheet. */
	| "home"
	/** The stream tagged with the student's programme, «(маркетинг)». */
	| "tag"
	/** The sheet that covers most of this student's ІНП; other streams exist. */
	| "rank"
	/** Nothing to go on: several streams, the one with most groups. */
	| "guess";

export interface InpPick {
	readonly entry: InpEntry;
	readonly disciplineId: DisciplineId;
	readonly basis: PickBasis;
	/** Every other published stream of this line, for the student to switch to. */
	readonly alternatives: ReadonlyArray<DisciplineId>;
}

export interface InpResolution {
	readonly published: ReadonlyArray<InpPick>;
	readonly unpublished: ReadonlyArray<InpEntry>;
	readonly courseOf: ReadonlyMap<DisciplineId, InpEntry>;
	/** The student's own sheet label, when the roster knows it. */
	readonly homeSheet: string | undefined;
}

export interface InpSemester {
	readonly offerings: ReadonlyArray<Offering>;
	/** Published files: `source` is the row's file name, `label` its programme. */
	readonly files?: ReadonlyArray<{
		readonly source: string;
		readonly label: string;
	}>;
}

/** The sheets an offering's rows come from, by label. */
export const sheetsOf = (
	offering: Offering,
	labelOf: (source: string) => string,
): ReadonlyArray<string> => {
	const seen = new Set<string>();
	for (const row of [
		...offering.lectures,
		...Object.values(offering.groups).flat(),
	]) {
		seen.add(labelOf(row.source));
	}
	return [...seen];
};

// The economics faculty publishes one sheet per year for four programmes and
// names the programme in parentheses: «Статистика (маркетинг)», «(марк.)»,
// «(фін+мар)». A tag is a qualifier word that starts one of these.
const PROGRAMME_TAGS: ReadonlyArray<
	readonly [programme: string, prefixes: ReadonlyArray<string>]
> = [
	["маркетинг", ["марк", "мар"]],
	["менеджмент", ["мен"]],
	["фінанси", ["фін"]],
	["економіка", ["екон"]],
];
const tagsOf = (discipline: string): ReadonlyArray<string> => {
	const out: string[] = [];
	for (const word of qualifiers(disciplineKey(discipline))) {
		const hit = PROGRAMME_TAGS.find(([, prefixes]) =>
			prefixes.some((p) => word.startsWith(p)),
		);
		if (hit && !out.includes(hit[0])) out.push(hit[0]);
	}
	return out;
};
const programmeTag = (programme: Programme): string | undefined =>
	PROGRAMME_TAGS.find(([name]) =>
		canonName(programme.name).toLowerCase().startsWith(name),
	)?.[0];

const groupCount = (offering: Offering): number =>
	Object.keys(offering.groups).length;
// \b is ASCII-only; the boundary before a Cyrillic word is spelled out.
const MASTER = /(?<!\p{L})МП-/u;
const sameLevel = (label: string, home: string): boolean =>
	MASTER.test(label) === MASTER.test(home);
const isPractice = (title: string): boolean =>
	/^практика(?!\p{L})/iu.test(title.trim());

/** Match every ІНП line against the parsed offerings of one semester and,
 *  where several streams match, pick the one this student attends: their
 *  own sheet first, then the stream tagged with their programme, then the
 *  sheet that covers most of their ІНП at the same level; the rest stay as
 *  alternatives. Without a programme the pick is the stream with most
 *  groups, as before, and says so. */
export const resolveInp = (
	semester: InpSemester,
	entries: ReadonlyArray<InpEntry>,
	programme?: Programme | null,
): InpResolution => {
	const labels = new Map(
		(semester.files ?? []).map((file) => [file.source, file.label]),
	);
	const labelOf = (source: string) => labels.get(source) ?? source;
	const sheetCache = new Map<DisciplineId, ReadonlyArray<string>>();
	const sheets = (offering: Offering) => {
		let found = sheetCache.get(offering.disciplineId);
		if (!found) {
			found = sheetsOf(offering, labelOf).map(canonName);
			sheetCache.set(offering.disciplineId, found);
		}
		return found;
	};
	const home = programme ? canonName(sheetLabelOf(programme)) : undefined;
	const tag = programme ? programmeTag(programme) : undefined;

	const matched = entries.map((entry) => ({
		entry,
		hits: matchOfferings(semester.offerings, entry),
	}));
	// How much of this student's ІНП each sheet covers: their second home is
	// the faculty sheet their programme has no file of its own for.
	const coverage = new Map<string, number>();
	for (const { hits } of matched) {
		const seen = new Set<string>();
		for (const hit of hits) for (const sheet of sheets(hit)) seen.add(sheet);
		for (const sheet of seen)
			coverage.set(sheet, (coverage.get(sheet) ?? 0) + 1);
	}
	const rankOf = (offering: Offering): number =>
		Math.max(...sheets(offering).map((sheet) => coverage.get(sheet) ?? 0));
	const mostGroups = (hits: ReadonlyArray<Offering>): Offering =>
		[...hits].sort((a, b) => groupCount(b) - groupCount(a))[0]!;

	const pick = (
		entry: InpEntry,
		hits: ReadonlyArray<Offering>,
	): [Offering, PickBasis] => {
		if (hits.length === 1) return [hits[0]!, "only"];
		if (home !== undefined) {
			const mine = hits.filter((hit) => sheets(hit).includes(home));
			if (mine.length === 1) return [mine[0]!, "home"];
			const pool = mine.length > 1 ? mine : hits;
			if (tag !== undefined) {
				const exact = pool.filter((hit) => {
					const tags = tagsOf(hit.discipline);
					return tags.length === 1 && tags[0] === tag;
				});
				if (exact.length === 1) return [exact[0]!, "tag"];
				const joint = pool.filter((hit) =>
					tagsOf(hit.discipline).includes(tag),
				);
				if (joint.length === 1) return [joint[0]!, "tag"];
			}
			if (mine.length > 1) return [mostGroups(mine), "home"];
			if (!isPractice(entry.title)) {
				const level = hits.filter((hit) =>
					sheets(hit).some((sheet) => sameLevel(sheet, home)),
				);
				const ranked = [...(level.length > 0 ? level : hits)].sort(
					(a, b) => rankOf(b) - rankOf(a),
				);
				if (ranked.length > 1 && rankOf(ranked[0]!) > rankOf(ranked[1]!))
					return [ranked[0]!, "rank"];
				if (ranked.length === 1) return [ranked[0]!, "rank"];
			}
		}
		return [mostGroups(hits), "guess"];
	};

	const published: Array<InpPick> = [];
	const unpublished: Array<InpEntry> = [];
	const courseOf = new Map<DisciplineId, InpEntry>();
	for (const { entry, hits } of matched) {
		if (hits.length === 0) {
			unpublished.push(entry);
			continue;
		}
		const [best, basis] = pick(entry, hits);
		published.push({
			entry,
			disciplineId: best.disciplineId,
			basis,
			alternatives: hits
				.filter((hit) => hit.disciplineId !== best.disciplineId)
				.map((hit) => hit.disciplineId),
		});
		courseOf.set(best.disciplineId, entry);
	}
	return { published, unpublished, courseOf, homeSheet: home };
};

export const displayNamesOf = (
	semester: { readonly offerings: ReadonlyArray<Offering> } | undefined,
	inp: InpResolution | undefined,
): ReadonlyMap<DisciplineId, string> => {
	const map = new Map<DisciplineId, string>();
	if (!semester || !inp) return map;
	for (const { disciplineId, entry } of inp.published) {
		const offering = semester.offerings.find(
			(o) => o.disciplineId === disciplineId,
		);
		if (offering)
			map.set(disciplineId, displayNameOf(offering.discipline, entry.title));
	}
	return map;
};

/** САЗ's registered group per course, keyed by the discipline that course
 *  is in the plan as: the picked stream, or the alternative the student
 *  switched to when `picked` says so. */
export const registeredByDisciplineOf = (
	inp: InpResolution | undefined,
	registered: Readonly<Record<string, string>> | undefined,
	picked: ReadonlyArray<DisciplineId> = [],
): RegisteredGroups => {
	const out: Record<DisciplineId, GroupLabel> = {};
	if (!inp || !registered) return out;
	const courseToDiscipline = new Map<string, DisciplineId>();
	for (const item of inp.published) {
		const chosen = item.alternatives.find((id) => picked.includes(id));
		courseToDiscipline.set(item.entry.courseId, chosen ?? item.disciplineId);
	}
	for (const [courseId, group] of Object.entries(registered)) {
		// SAFETY: courseId is either a known discipline id via ІНП or a raw САЗ id kept as-is for banner.
		const key = (courseToDiscipline.get(courseId) ?? courseId) as DisciplineId;
		// SAFETY: server /api/me registered groups are validated GroupLabel strings.
		out[key] = group as GroupLabel;
	}
	return out;
};

export const variantOf = (offering: Offering): string | undefined => {
	const [, ...variant] = offering.discipline.split(" · ");
	return variant.length > 0 ? variant.join(" · ") : undefined;
};

export const baseOf = (offering: Offering): string =>
	baseName(offering.discipline);

const fold = (value: string): string =>
	value
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim();

/** The lessons the parser could not place for this discipline: rows of the
 *  same file whose discipline cell starts with this discipline's name. */
export const unplacedOf = <
	R extends { readonly source: string; readonly discipline: string },
>(
	offering: Offering,
	review: ReadonlyArray<R>,
): ReadonlyArray<R> => {
	const sources = new Set(
		[...offering.lectures, ...Object.values(offering.groups).flat()].map(
			(row) => row.source,
		),
	);
	const name = fold(baseName(offering.discipline));
	return review.filter(
		(item) =>
			sources.has(item.source) && fold(item.discipline).startsWith(name),
	);
};
