import { getSemesterTermDisplay } from "@/features/courses/courseFormatting";
import type { StudentRatingsDetailed } from "@/lib/api/generated";

export type RatingFilter = "all" | "unrated" | "rated";

export interface SemesterGroup {
	key: string;
	label: string;
	description: string;
	items: StudentRatingsDetailed[];
	order: number;
	ratedCount: number;
	totalCount: number;
	unratedRateableCount: number;
	year?: number;
	seasonRaw?: string;
}

export interface YearGroup {
	key: string;
	label: string;
	seasons: SemesterGroup[];
	year?: number;
	total: number;
	ratedCount: number;
}

const TERM_ORDER: Record<string, number> = {
	FALL: 1,
	SPRING: 2,
	SUMMER: 3,
};

function getAcademicYear(
	year: number,
	season: string | undefined,
): { academicYearStart: number; academicYearLabel: string } {
	const academicYearStart = season?.toUpperCase() === "FALL" ? year : year - 1;
	const academicYearLabel = `${academicYearStart} – ${academicYearStart + 1}`;
	return { academicYearStart, academicYearLabel };
}

interface YearInfo {
	key: string;
	label: string;
	academicYearStart?: number;
}

function resolveYearInfo(
	yearValue: number | undefined,
	seasonRaw: string | undefined,
): YearInfo {
	if (yearValue == null) {
		return { key: "unknown", label: "Без року" };
	}
	const { academicYearStart, academicYearLabel } = getAcademicYear(
		yearValue,
		seasonRaw,
	);
	return {
		key: String(academicYearStart),
		label: academicYearLabel,
		academicYearStart,
	};
}

interface SeasonInfo {
	key: string;
	label: string;
	description: string;
	order: number;
}

function resolveSeasonInfo(
	yearValue: number | undefined,
	seasonRaw: string | undefined,
): SeasonInfo {
	if (yearValue == null) {
		return {
			key: "no-semester",
			label: "Без семестра",
			description: "Невідомий рік",
			order: TERM_ORDER[seasonRaw ?? ""] ?? 99,
		};
	}

	const key = seasonRaw ?? "no-semester";
	const label = seasonRaw
		? getSemesterTermDisplay(seasonRaw, "Невідомий семестр")
		: "Семестр не вказано";
	const description = seasonRaw
		? `Семестр ${label.toLowerCase()}`
		: "Без семестра";

	return {
		key,
		label,
		description,
		order: TERM_ORDER[seasonRaw ?? ""] ?? 99,
	};
}

function matchesRatingFilter(
	course: StudentRatingsDetailed,
	filter: RatingFilter,
): boolean {
	if (filter === "all") return true;
	const isRated = Boolean(course.rated);
	return filter === "rated" ? isRated : !isRated;
}

function updateSeasonCounts(
	group: SemesterGroup,
	course: StudentRatingsDetailed,
	matchesFilter: boolean,
): void {
	group.totalCount++;
	if (course.rated) {
		group.ratedCount++;
	} else if (course.can_rate) {
		group.unratedRateableCount++;
	}
	if (matchesFilter) {
		group.items.push(course);
	}
}

type YearAccumulator = {
	key: string;
	label: string;
	year?: number;
	seasons: Map<string, SemesterGroup>;
};

function toYearGroups(years: Map<string, YearAccumulator>): YearGroup[] {
	return Array.from(years.values())
		.sort((a, b) => {
			if (a.key === "unknown") return 1;
			if (b.key === "unknown") return -1;
			return Number(b.key) - Number(a.key);
		})
		.map((year) => {
			const seasons = Array.from(year.seasons.values())
				.filter((s) => s.items.length > 0)
				.sort((a, b) => b.order - a.order);

			return {
				key: year.key,
				label: year.label,
				year: year.year,
				seasons,
				total: seasons.reduce((acc, s) => acc + s.totalCount, 0),
				ratedCount: seasons.reduce((acc, s) => acc + s.ratedCount, 0),
			};
		})
		.filter((year) => year.seasons.length > 0);
}

export function groupRatingsByYearAndSemester(
	allRatings: StudentRatingsDetailed[],
	filter: RatingFilter = "all",
): YearGroup[] {
	const years = new Map<string, YearAccumulator>();

	for (const course of allRatings) {
		const yearValue =
			typeof course.semester?.year === "number"
				? course.semester.year
				: undefined;
		const seasonRaw = course.semester?.season?.toUpperCase();

		const yearInfo = resolveYearInfo(yearValue, seasonRaw);
		const seasonInfo = resolveSeasonInfo(yearValue, seasonRaw);

		if (!years.has(yearInfo.key)) {
			years.set(yearInfo.key, {
				key: yearInfo.key,
				label: yearInfo.label,
				year: yearInfo.academicYearStart,
				seasons: new Map(),
			});
		}

		const yearEntry = years.get(yearInfo.key);
		if (!yearEntry) continue;

		if (!yearEntry.seasons.has(seasonInfo.key)) {
			yearEntry.seasons.set(seasonInfo.key, {
				key: `${yearInfo.key}-${seasonInfo.key}`,
				label: seasonInfo.label,
				description: seasonInfo.description,
				items: [],
				order: seasonInfo.order,
				ratedCount: 0,
				totalCount: 0,
				unratedRateableCount: 0,
				year: yearValue,
				seasonRaw,
			});
		}

		const seasonGroup = yearEntry.seasons.get(seasonInfo.key);
		if (!seasonGroup) continue;

		updateSeasonCounts(
			seasonGroup,
			course,
			matchesRatingFilter(course, filter),
		);
	}

	return toYearGroups(years);
}
