import type { PlanLessons, WeekDates } from "@/features/schedule/core";
import {
	DAYS,
	describeTime,
	expandRows,
	groupOf,
	placeOf,
	timeOf,
	toIcs,
} from "@/features/schedule/core";
import { Effect } from "effect";
import type { Semester } from "@/features/schedule/lib/data";
import { weekPatternOf } from "@/features/schedule/lib/weeks";

/** The timetable as plain text, one day per block, ready for a chat or a note. */
export const planAsText = (
	semesterName: string,
	lessons: PlanLessons,
	weekDates: WeekDates,
): string => {
	const ordered = [...lessons.rows].sort(
		(a, b) =>
			DAYS.indexOf(a.day) - DAYS.indexOf(b.day) ||
			timeOf(a).start.localeCompare(timeOf(b).start),
	);
	const blocks: string[] = [];
	for (const day of DAYS) {
		const dayRows = ordered.filter((row) => row.day === day);
		if (dayRows.length === 0) continue;
		const lines = dayRows.map((row) => {
			const place = placeOf(row);
			const pattern = weekPatternOf(row.weeks, weekDates);
			const parts = [
				lessons.labels.get(row.disciplineId) ?? row.discipline,
				groupOf(row),
				...(place ? [place] : []),
				// The default needs no label: every-week lessons show no weeks line.
				...(pattern.kind === "every" ? [] : [pattern.label]),
			];
			return `  ${describeTime(timeOf(row)).replace(" пара ", " пара, ")}: ${parts.join(", ")}`;
		});
		blocks.push([day, ...lines].join("\n"));
	}
	return [`Розклад, ${semesterName}`, ...blocks].join("\n\n");
};

/** The timetable as a calendar file. Owns the Effect run so no .tsx imports it. */
export const buildIcs = (semester: Semester, lessons: PlanLessons): string =>
	Effect.runSync(
		toIcs(
			[
				{
					events: expandRows(lessons.rows, semester.weekDates).events,
					files: semester.files,
					labels: lessons.labels,
				},
			],
			{
				name: `Розклад Rate UKMA, ${semester.name}`,
				origin: window.location.origin,
			},
		),
	);
