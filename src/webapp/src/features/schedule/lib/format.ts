import type { LessonRow } from "@/features/schedule/core";
import {
	clockOf,
	DAY_SHORT,
	formatWeeks,
	timeOf,
} from "@/features/schedule/core";

export { DAY_SHORT, formatWeeks, shortName } from "@/features/schedule/core";

export const describeRow = (row: LessonRow): string =>
	`${DAY_SHORT[row.day] ?? row.day} ${clockOf(timeOf(row))}, тижні ${formatWeeks(row.weeks)}`;

/** "2026-09-01" -> "01.09" */
export const shortDate = (iso: string): string => {
	const [, month, day] = iso.split("-");
	return `${day}.${month}`;
};

const RELATIVE = new Intl.RelativeTimeFormat("uk", { numeric: "auto" });
const RELATIVE_UNITS = [
	[60_000, "second", 1_000],
	[3_600_000, "minute", 60_000],
	[86_400_000, "hour", 3_600_000],
	[2_592_000_000, "day", 86_400_000],
] as const;

/** An ISO instant as "5 хвилин тому"; falls back to the date past a month. */
export const relativeTime = (iso: string, now = Date.now()): string => {
	const elapsed = now - Date.parse(iso);
	for (const [limit, unit, divisor] of RELATIVE_UNITS) {
		if (elapsed < limit)
			return RELATIVE.format(-Math.round(elapsed / divisor), unit);
	}
	return new Date(iso).toLocaleDateString("uk");
};

/** The same instant clipped for a toolbar hint: "щойно", "5 хв тому", "2 год тому", "вчора", "18.08". */
export const shortAgo = (iso: string, now = Date.now()): string => {
	const elapsed = now - Date.parse(iso);
	if (elapsed < 60_000) return "щойно";
	if (elapsed < 3_600_000) return `${Math.round(elapsed / 60_000)} хв тому`;
	if (elapsed < 86_400_000)
		return `${Math.round(elapsed / 3_600_000)} год тому`;
	if (elapsed < 172_800_000) return "вчора";
	return new Date(iso).toLocaleDateString("uk", {
		day: "2-digit",
		month: "2-digit",
	});
};

/** A week on the toolbar: «14–18 вересня», or «28 вересня – 2 жовтня» across a month edge. */
export const formatSpan = (startIso: string, endIso: string): string => {
	const start = new Date(startIso);
	const end = new Date(endIso);
	const long = (date: Date) =>
		date.toLocaleDateString("uk", { day: "numeric", month: "long" });
	return start.getMonth() === end.getMonth()
		? `${start.getDate()}–${long(end)}`
		: `${long(start)} – ${long(end)}`;
};

/** «Мар’яна Демченко» becomes «МД» for an avatar; a lone word gives one letter. */
export const initials = (name: string): string =>
	name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((word) => word[0]?.toUpperCase() ?? "")
		.join("");

/** The full local timestamp behind a `shortAgo` hint, for its `title`. */
export const absoluteTime = (iso: string): string =>
	new Date(iso).toLocaleString("uk", {
		dateStyle: "short",
		timeStyle: "short",
	});

/** The form alone, for when the number is shown some other way. */
export const wordFor = (
	count: number,
	forms: readonly [string, string, string],
): string => {
	const mod10 = count % 10;
	const mod100 = count % 100;
	return mod10 === 1 && mod100 !== 11
		? forms[0]
		: mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
			? forms[1]
			: forms[2];
};

/** Ukrainian count noun: forms for 1, 2–4 and 5+ («1 розбіжність», «2 розбіжності», «5 розбіжностей»). */
export const plural = (
	count: number,
	forms: readonly [string, string, string],
): string => {
	return `${count} ${wordFor(count, forms)}`;
};
