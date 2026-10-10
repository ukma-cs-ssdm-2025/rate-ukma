import { Schema } from "effect";
import { DisciplineId, GroupLabel, LessonRow, isLecture } from "./schedule.ts";

/**
 * Stage 1 shape: a discipline together with *all* of its groups.
 *
 * `lectures` are mandatory and carry no choice. `groups` maps each selectable
 * group label to the rows that group attends. A student picks exactly one key
 * of `groups` — or none, when a discipline is lecture-only.
 */
export const Offering = Schema.Struct({
	disciplineId: DisciplineId,
	discipline: Schema.NonEmptyString,
	lectures: Schema.Array(LessonRow),
	groups: Schema.Record(GroupLabel, Schema.Array(LessonRow)),
});
export interface Offering extends Schema.Schema.Type<typeof Offering> {}

/** Group the flat rows the parser produced into per-discipline offerings. */
export const fromRows = (
	rows: ReadonlyArray<LessonRow>,
): ReadonlyArray<Offering> => {
	const byDiscipline = new Map<DisciplineId, Array<LessonRow>>();
	for (const row of rows) {
		const bucket = byDiscipline.get(row.disciplineId);
		if (bucket) bucket.push(row);
		else byDiscipline.set(row.disciplineId, [row]);
	}

	return [...byDiscipline].map(([disciplineId, disciplineRows]) => {
		const groups: Record<string, Array<LessonRow>> = {};
		const lectures: Array<LessonRow> = [];
		for (const row of disciplineRows) {
			if (isLecture(row)) lectures.push(row);
			else (groups[row.group] ??= []).push(row);
		}
		return {
			disciplineId,
			discipline: disciplineRows[0]!.discipline,
			lectures,
			groups,
		} satisfies Offering;
	});
};

export const groupLabels = (offering: Offering): ReadonlyArray<GroupLabel> =>
	// SAFETY: Offering.groups is keyed by GroupLabel by construction (fromRows).
	Object.keys(offering.groups) as Array<GroupLabel>;

/** A discipline with no selectable groups needs no decision from the student. */
export const isLectureOnly = (offering: Offering): boolean =>
	groupLabels(offering).length === 0;

/**
 * A discipline is an offering *per programme sheet*: each sheet lists the
 * lecture stream and groups that programme's students attend. Sheets that
 * publish identical content merge into one offering; sheets that disagree
 * (e.g. ІПЗ БП-4 has its own БПП lecture stream) stay separate offerings,
 * labelled with the programme, because uniting them fabricates clashes.
 */
export const resolveVariants = (
	rows: ReadonlyArray<LessonRow>,
	labelOf: (source: string) => string,
): ReadonlyArray<LessonRow> => {
	const bySheet = new Map<string, LessonRow[]>();
	for (const row of rows) {
		const key = `${row.disciplineId}\u0000${row.source}`;
		const bucket = bySheet.get(key);
		if (bucket) bucket.push(row);
		else bySheet.set(key, [row]);
	}

	const line = (row: LessonRow): string =>
		`${row.group}|${row.day}|${row.slot}|${row.weeks.join(",")}|${row.room ?? ""}`;
	const lectureSig = (view: LessonRow[]): string =>
		view
			.filter((row) => row.group === "лекція")
			.map(line)
			.sort()
			.join("\n");
	const groupSigs = (view: LessonRow[]): Map<string, string> => {
		const byGroup = new Map<string, string[]>();
		for (const row of view) {
			if (row.group === "лекція") continue;
			const bucket = byGroup.get(row.group);
			if (bucket) bucket.push(line(row));
			else byGroup.set(row.group, [line(row)]);
		}
		return new Map(
			[...byGroup].map(([group, lines]) => [group, lines.sort().join("\n")]),
		);
	};

	// Two sheet views are the SAME offering seen partially (-> merge) when their
	// lectures agree (or one lists none) and every shared group is identical.
	// Otherwise they are different streams -> separate labelled variants.
	const compatible = (a: LessonRow[], b: LessonRow[]): boolean => {
		const lecturesA = lectureSig(a);
		const lecturesB = lectureSig(b);
		if (lecturesA && lecturesB && lecturesA !== lecturesB) return false;
		const groupsA = groupSigs(a);
		for (const [group, sig] of groupSigs(b)) {
			const existing = groupsA.get(group);
			if (existing !== undefined && existing !== sig) return false;
		}
		return true;
	};

	// discipline -> per-sheet views, in stable source order
	const views = new Map<string, LessonRow[][]>();
	for (const [key, sheetRows] of [...bySheet].sort(([a], [b]) =>
		a.localeCompare(b),
	)) {
		const disciplineId = key.split("\u0000")[0]!;
		const list = views.get(disciplineId) ?? [];
		list.push(sheetRows);
		views.set(disciplineId, list);
	}

	const out: LessonRow[] = [];
	for (const [disciplineId, sheetViews] of views) {
		const clusters: LessonRow[][] = [];
		for (const view of sheetViews) {
			const home = clusters.find((cluster) => compatible(cluster, view));
			if (!home) {
				clusters.push([...view]);
				continue;
			}
			const seen = new Set(home.map(line));
			for (const row of view) {
				if (!seen.has(line(row))) {
					seen.add(line(row));
					home.push(row);
				}
			}
		}
		if (clusters.length === 1) {
			out.push(...clusters[0]!);
			continue;
		}
		for (const cluster of clusters) {
			const label = labelOf(cluster[0]!.source);
			const variantId = `${disciplineId} · ${label}`;
			out.push(
				...cluster.map((row) => ({
					...row,
					// SAFETY: a non-empty id suffixed with a label stays a valid DisciplineId.
					disciplineId: variantId as typeof row.disciplineId,
					discipline: `${row.discipline} · ${label}`,
				})),
			);
		}
	}
	return out;
};
