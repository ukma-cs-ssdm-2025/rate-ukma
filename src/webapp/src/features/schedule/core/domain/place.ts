import type { LessonRow } from "./schedule.ts";

/**
 * The `room` column is hand-typed and wildly inconsistent: «Дистанц.», «7 –
 * 302а/ 307/302б», «КМЦ 2пов», «1-000/ 3D-друк», «*». `describePlace` turns one
 * such cell into a single readable place, or into nothing when the cell says
 * nothing. It scans left to right, trying the known shapes at each position and
 * dropping whatever matches none of them.
 */

/** Cells that carry no place at all: empty, «*», «**», «?», «-». */
const NOTHING = /^[-*?.\s]*$/;

/** The whole cell being «Д» is the shortest way the sheets write «дистанційно». */
const LONE_D = /^[Дд]\.?$/;

const KMC = /^КМЦ/i;
const NOTE_3D = /^3\s*-?\s*D[\s-]*друк/i;
const MIXED = /^змішано/i;
/** Building, dash, room («7 – 302а», «1-310Б»), optionally a range («6-105-108»). */
const ROOM =
	/^(\d{1,2})\s*[-–]\s*(\d{1,3}[а-яіїєА-ЯІЇЄa-zA-Z]?)(?:\s*-\s*(\d{1,3}))?/;
/** A remote marker, even glued to a prefix that is not a place («Л15с15Дистанц.»). */
const REMOTE = /^[^\s,/]*?(?:дистанц|дистнац|онлайн|online)[^\s,/]*/i;
const BUILDING = /^(\d{1,2})\s*(?:корпус|к)(?![а-яіїєa-z])/i;
/** A room number without its building («307» in «7 – 302а/ 307»), or a bare «001». */
const BARE = /^(\d{1,3}[а-яіїєА-ЯІЇЄa-zA-Z]?)(?![-–\d])/;
/** A letter torn off its room by a slash: «1-310/Б». */
const SUFFIX = /^[а-яіїєА-ЯІЇЄa-zA-Z](?![а-яіїєА-ЯІЇЄa-zA-Z])/;
/** «офлайн» adds nothing a room does not already say; «укр» is a course note. */
const IGNORED = /^(?:офлайн|укр)(?![а-яіїє])/i;
const SEPARATOR = /^[\s,/+*?.()–—-]+/;
const WORD = /^[^\s,/+]+/;

const HAS_LETTER = /[а-яіїєА-ЯІЇЄa-zA-Z]$/;

/** Where a lesson is, for every renderer. A room the student typed (their
 *  own lesson, or a correction) is theirs to word and shows as typed; a
 *  sheet's cell goes through `describePlace`. */
export const placeOf = (row: LessonRow): string | undefined => {
	const typed =
		row.custom !== undefined || (row.printed && row.printed.room !== row.room);
	if (!typed) return describePlace(row.room);
	const text = row.room?.trim();
	return text ? text : undefined;
};

export const describePlace = (room: string | undefined): string | undefined => {
	const text = room?.trim() ?? "";
	if (NOTHING.test(text)) return undefined;
	if (LONE_D.test(text)) return "дистанційно";
	// Every КМЦ cell is about КМЦ and nothing else; the first floor it mentions
	// is the one to show («КМЦ 3 пооверх/КМЦ 2» is one place written twice).
	if (KMC.test(text)) {
		const floor = /\d/.exec(text);
		return floor ? `КМЦ, ${floor[0]} поверх` : "КМЦ";
	}

	const rooms: Array<string> = [];
	let building: string | undefined;
	let corpus: string | undefined;
	let note: string | undefined;
	let remote = false;
	let mixed = false;
	let known = false;

	let rest = text;
	while (rest.length > 0) {
		const noteMatch = NOTE_3D.exec(rest);
		if (noteMatch) {
			note = "3D-друк";
			known = true;
			rest = rest.slice(noteMatch[0].length);
			continue;
		}
		if (MIXED.test(rest)) {
			mixed = true;
			known = true;
			rest = rest.replace(MIXED, "");
			continue;
		}
		const roomMatch = ROOM.exec(rest);
		if (roomMatch) {
			building = roomMatch[1];
			const range = roomMatch[3] === undefined ? "" : `-${roomMatch[3]}`;
			rooms.push(`${building}-${roomMatch[2]!.toLowerCase()}${range}`);
			known = true;
			rest = rest.slice(roomMatch[0].length);
			continue;
		}
		const remoteMatch = REMOTE.exec(rest);
		if (remoteMatch) {
			remote = true;
			known = true;
			rest = rest.slice(remoteMatch[0].length);
			continue;
		}
		const buildingMatch = BUILDING.exec(rest);
		if (buildingMatch) {
			corpus = `${buildingMatch[1]} корпус`;
			known = true;
			rest = rest.slice(buildingMatch[0].length);
			continue;
		}
		const bareMatch = BARE.exec(rest);
		if (bareMatch) {
			const number = bareMatch[1]!.toLowerCase();
			rooms.push(building === undefined ? number : `${building}-${number}`);
			known = true;
			rest = rest.slice(bareMatch[0].length);
			continue;
		}
		const suffixMatch = SUFFIX.exec(rest);
		const last = rooms.at(-1);
		if (suffixMatch && last !== undefined && !HAS_LETTER.test(last)) {
			rooms[rooms.length - 1] = `${last}${suffixMatch[0].toLowerCase()}`;
			rest = rest.slice(suffixMatch[0].length);
			continue;
		}
		const ignoredMatch = IGNORED.exec(rest);
		if (ignoredMatch) {
			known = true;
			rest = rest.slice(ignoredMatch[0].length);
			continue;
		}
		const separatorMatch = SEPARATOR.exec(rest);
		if (separatorMatch) {
			rest = rest.slice(separatorMatch[0].length);
			continue;
		}
		const wordMatch = WORD.exec(rest);
		rest = wordMatch === null ? "" : rest.slice(wordMatch[0].length);
	}

	const unique = [...new Set(rooms)];
	const head = unique.length > 0 ? `ауд. ${unique.join(", ")}` : corpus;
	const base = remote
		? head === undefined
			? "дистанційно"
			: `${head} або дистанційно`
		: head;
	const parts = [base, mixed ? "змішано" : undefined, note].filter(
		(part) => part !== undefined,
	);
	if (parts.length > 0) return parts.join(", ");
	// Nothing matched a known shape: the cell is a venue in words («Колізей»,
	// «Дворик біля музею»), so it is already the best thing to show.
	return known ? undefined : text;
};
