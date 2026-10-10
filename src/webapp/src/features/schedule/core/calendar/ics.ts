import { Clock, Effect } from "effect";
import { placeOf } from "../domain/place.ts";
import type { DatedLesson } from "./dates.ts";

/**
 * Render dated lessons as an iCalendar file. Times are Europe/Kyiv wall clock,
 * carried with a VTIMEZONE so every client interprets them identically.
 * DTSTAMP comes from the Clock service — deterministic under TestClock.
 */

const TIMEZONE = `BEGIN:VTIMEZONE
TZID:Europe/Kyiv
BEGIN:STANDARD
DTSTART:19701025T040000
TZOFFSETFROM:+0300
TZOFFSETTO:+0200
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:19700329T030000
TZOFFSETFROM:+0200
TZOFFSETTO:+0300
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
END:VTIMEZONE`;

const escapeText = (value: string): string =>
	value
		.replace(/\\/g, "\\\\")
		.replace(/;/g, "\\;")
		.replace(/,/g, "\\,")
		.replace(/\n/g, "\\n");

const compact = (iso: string): string => iso.replace(/-/g, "");

const compactTime = (time: string): string => `${time.replace(":", "")}00`;

const stamp = (millis: number): string => {
	const iso = new Date(millis).toISOString();
	return `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}T${iso.slice(11, 13)}${iso.slice(14, 16)}${iso.slice(17, 19)}Z`;
};

/** A published file the events came from, for the link in every description. */
export interface IcsFile {
	readonly source: string;
	readonly label: string;
	readonly url: string;
	/** Our own archived copy («/files/<sha>.xlsx»), when there is one. */
	readonly stored?: string | null;
}

/** One semester's share of a calendar: its events, and the sheet files and
 *  discipline labels those events refer to. Files and labels are per
 *  semester because file names and abbreviations repeat across years. */
export interface IcsPart {
	readonly events: ReadonlyArray<DatedLesson>;
	readonly files?: ReadonlyArray<IcsFile>;
	/** What to call each discipline in the SUMMARY; the sheet name otherwise. */
	readonly labels?: ReadonlyMap<string, string>;
}

export interface IcsOptions {
	/** The calendar's own name, what a client shows instead of the feed URL. */
	readonly name?: string;
	/** Origin the relative `stored` paths are resolved against. */
	readonly origin?: string;
}

const shortName = (discipline: string): string => discipline.split(" · ")[0]!;

const fileLink = (
	source: string,
	part: IcsPart,
	options: IcsOptions,
): ReadonlyArray<string> => {
	const file = part.files?.find((entry) => entry.source === source);
	if (!file) return [`Файл розкладу: ${source}`];
	const link =
		file.stored && options.origin
			? `${options.origin.replace(/\/+$/, "")}${file.stored}`
			: file.url;
	return [`Файл розкладу: ${file.label}`, link];
};

const event = (
	lesson: DatedLesson,
	dtstamp: string,
	part: IcsPart,
	options: IcsOptions,
): string => {
	const { date, row, time, week } = lesson;
	const lecture = row.group === "лекція";
	const name = part.labels?.get(row.disciplineId) ?? shortName(row.discipline);
	const own = row.custom !== undefined;
	const summary = own
		? name
		: lecture
			? `${name} (лекція)`
			: `${name} (практика, гр. ${row.group})`;
	const description = [
		row.teacher,
		`Тиждень ${week}`,
		own
			? "Своя пара, додана вручну"
			: lecture
				? "Лекція"
				: `Практичне або семінарське заняття, група ${row.group}`,
		...(row.printed ? ["Час або місце змінено вручну"] : []),
		...(own ? [] : fileLink(row.source, part, options)),
	]
		.filter(Boolean)
		.map((line) => escapeText(line ?? ""))
		.join("\\n");
	const lines = [
		"BEGIN:VEVENT",
		`UID:${compact(date)}-${compactTime(time.start)}-${escapeText(row.custom ?? row.disciplineId)}-${escapeText(row.group)}@ukma-schedule`,
		`DTSTAMP:${dtstamp}`,
		`DTSTART;TZID=Europe/Kyiv:${compact(date)}T${compactTime(time.start)}`,
		`DTEND;TZID=Europe/Kyiv:${compact(date)}T${compactTime(time.end)}`,
		`SUMMARY:${escapeText(summary)}`,
		`DESCRIPTION:${description}`,
	];
	const place = placeOf(row);
	if (place) lines.push(`LOCATION:${escapeText(place)}`);
	lines.push("END:VEVENT");
	return lines.join("\r\n");
};

/** One calendar from any number of semester parts, oldest first: a student
 *  subscribes once and every semester they plan lands in the same feed. */
export const toIcs = Effect.fn("Calendar.toIcs")(function* (
	parts: ReadonlyArray<IcsPart>,
	options: IcsOptions = {},
) {
	const now = yield* Clock.currentTimeMillis;
	const dtstamp = stamp(now);
	const name = options.name ?? "Розклад НаУКМА";
	return [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//ukma-schedule//UA",
		"CALSCALE:GREGORIAN",
		// NAME is RFC 7986; X-WR-CALNAME is what Google and Apple actually read.
		`NAME:${escapeText(name)}`,
		`X-WR-CALNAME:${escapeText(name)}`,
		"X-WR-TIMEZONE:Europe/Kyiv",
		"REFRESH-INTERVAL;VALUE=DURATION:PT1H",
		"X-PUBLISHED-TTL:PT1H",
		TIMEZONE,
		...parts.flatMap((part) =>
			part.events.map((lesson) => event(lesson, dtstamp, part, options)),
		),
		"END:VCALENDAR",
		"",
	].join("\r\n");
});
