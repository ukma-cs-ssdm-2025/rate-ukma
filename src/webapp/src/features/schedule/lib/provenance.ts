import type {
	DisciplineId,
	InpResolution,
	Offering,
	PickBasis,
} from "@/features/schedule/core";
import {
	canonName,
	isCustomOffering,
	sheetsOf,
} from "@/features/schedule/core";
import type { Semester } from "@/features/schedule/lib/data";

/** Where a discipline's lessons come from, in terms the student can check:
 *  the sheets that publish them, whether that is their own programme's
 *  sheet, why this stream was picked, and how many other streams exist. */
export interface Provenance {
	readonly sheets: ReadonlyArray<string>;
	/** No sheet of this offering is the student's own. Unknown home: false. */
	readonly foreign: boolean;
	/** Why this stream; «chosen» when it is not the one the rule would pick:
	 *  the student switched, or the plan was saved before their programme
	 *  was known. */
	readonly basis: PickBasis | "chosen" | undefined;
	readonly alternatives: ReadonlyArray<DisciplineId>;
	/** The stream the rule would pick, when it is another one and comes
	 *  from the student's own sheet. */
	readonly ownStream: DisciplineId | undefined;
}

/** The ІНП pick this offering belongs to: as the picked stream or as one of
 *  its alternatives the student switched to. */
export const inpPickFor = (inp: InpResolution | undefined, id: DisciplineId) =>
	inp?.published.find(
		(item) => item.disciplineId === id || item.alternatives.includes(id),
	);

export const provenanceOf = (
	offering: Offering,
	semester: Pick<Semester, "files">,
	inp: InpResolution | undefined,
): Provenance => {
	const labels = new Map(
		semester.files.map((file) => [file.source, file.label]),
	);
	// The student's own lessons come from no sheet at all.
	const sheets = isCustomOffering(offering)
		? []
		: sheetsOf(offering, (source) => labels.get(source) ?? source);
	const home = inp?.homeSheet;
	const pick = inpPickFor(inp, offering.disciplineId);
	const streams = pick ? [pick.disciplineId, ...pick.alternatives] : [];
	const current = pick?.disciplineId === offering.disciplineId;
	return {
		sheets,
		foreign:
			home !== undefined &&
			sheets.length > 0 &&
			!sheets.some((sheet) => canonName(sheet) === home),
		basis: pick === undefined ? undefined : current ? pick.basis : "chosen",
		alternatives: streams.filter((id) => id !== offering.disciplineId),
		ownStream:
			pick && !current && pick.basis === "home" ? pick.disciplineId : undefined,
	};
};

/** «ІПЗ БП-4» for «Інженерія програмного забезпечення БП-4»: the sheet label
 *  shortened the way students say it, initials of the programme plus the
 *  year, so a badge fits on one line. Short programme names stay whole. */
export const shortSheet = (label: string): string => {
	const match = /^(.*?)\s+((?:БП|МП)-\d)$/u.exec(label.trim());
	if (!match) return label;
	const [, programme, year] = match;
	const words = programme!
		.replace(/\(.*?\)/g, "")
		.split(/[\s,]+/)
		.filter((w) => w.length > 2);
	const name =
		programme!.length <= 12 || words.length < 2
			? programme!
			: words.map((word) => word[0]!.toUpperCase()).join("");
	return `${name} ${year}`;
};

/** What the badge says: the sheets, plus how many other streams exist.
 *  Every lesson names its stream; only a locked plan drops the count,
 *  since there is nothing left to switch to. */
export const provenanceText = (
	provenance: Provenance,
	options: { readonly settled?: boolean } = {},
): string => {
	const { sheets, alternatives } = provenance;
	const where = sheets.map(shortSheet).join(", ");
	if (options.settled) return where;
	const more = alternatives.length > 0 ? `, ще ${alternatives.length}` : "";
	return `${where}${more}`;
};

/** The sheet; and, only while there is something to decide, how the
 *  stream was determined and that others exist. Plain statements. */
export const provenanceHint = (
	provenance: Provenance,
	options: { readonly settled?: boolean } = {},
): string => {
	const { sheets, basis, alternatives } = provenance;
	if (sheets.length === 0) return "Своя пара, додана вручну";
	const where = `Розклад: ${sheets.join(", ")}`;
	if (options.settled || alternatives.length === 0) return where;
	const how =
		basis === "rank"
			? "Потік визначено за ІНП."
			: basis === "guess"
				? "Потік не визначено."
				: basis === "chosen" && provenance.ownStream !== undefined
					? "Розклад програми має власний потік."
					: undefined;
	return [`${where}.`, how, `Інших потоків: ${alternatives.length}.`]
		.filter(Boolean)
		.join(" ");
};

/** Rank and guess picks are the ones worth a second look. */
export const provenanceUnsure = (provenance: Provenance): boolean =>
	provenance.basis === "rank" ||
	provenance.basis === "guess" ||
	provenance.ownStream !== undefined;
