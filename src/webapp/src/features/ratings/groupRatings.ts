import { getSemesterTermDisplay } from "@/features/courses/courseFormatting";
import type {
	SemesterTermEnum,
	StudentRatingsDetailed,
} from "@/lib/api/generated";

export interface SemesterGroup {
	key: string;
	label: string;
	description: string;
	items: StudentRatingsDetailed[];
	order: number;
	ratedCount: number;
	totalCount: number;
	unratedRateableCount: number;
	year: number;
	season: SemesterTermEnum;
}

export interface YearGroup {
	key: string;
	label: string;
	seasons: SemesterGroup[];
	year: number;
	total: number;
	ratedCount: number;
}

const TERM_ORDER = {
	FALL: 1,
	SPRING: 2,
	SUMMER: 3,
} satisfies Record<SemesterTermEnum, number>;

function academicYearStart(year: number, season: SemesterTermEnum): number {
	return season === "FALL" ? year : year - 1;
}

interface YearAccumulator {
	key: string;
	label: string;
	year: number;
	seasons: Map<SemesterTermEnum, SemesterGroup>;
}

function emptySemesterGroup(
	yearKey: string,
	year: number,
	season: SemesterTermEnum,
): SemesterGroup {
	const label = getSemesterTermDisplay(season);
	return {
		key: `${yearKey}-${season}`,
		label,
		description: `Семестр ${label.toLowerCase()}`,
		items: [],
		order: TERM_ORDER[season],
		ratedCount: 0,
		totalCount: 0,
		unratedRateableCount: 0,
		year,
		season,
	};
}

function addCourse(group: SemesterGroup, course: StudentRatingsDetailed): void {
	group.totalCount++;
	if (course.rated) {
		group.ratedCount++;
	} else if (course.can_rate) {
		group.unratedRateableCount++;
	}
	group.items.push(course);
}

function toYearGroup(year: YearAccumulator): YearGroup {
	const seasons = [...year.seasons.values()].sort((a, b) => b.order - a.order);
	return {
		key: year.key,
		label: year.label,
		year: year.year,
		seasons,
		total: seasons.reduce((acc, s) => acc + s.totalCount, 0),
		ratedCount: seasons.reduce((acc, s) => acc + s.ratedCount, 0),
	};
}

export function groupRatingsByYearAndSemester(
	allRatings: readonly StudentRatingsDetailed[],
): YearGroup[] {
	const years = new Map<string, YearAccumulator>();

	for (const course of allRatings) {
		const { year, season } = course.semester;
		const start = academicYearStart(year, season);
		const yearKey = String(start);

		let yearEntry = years.get(yearKey);
		if (!yearEntry) {
			yearEntry = {
				key: yearKey,
				label: `${start} – ${start + 1}`,
				year: start,
				seasons: new Map(),
			};
			years.set(yearKey, yearEntry);
		}

		let seasonGroup = yearEntry.seasons.get(season);
		if (!seasonGroup) {
			seasonGroup = emptySemesterGroup(yearKey, year, season);
			yearEntry.seasons.set(season, seasonGroup);
		}

		addCourse(seasonGroup, course);
	}

	return [...years.values()].sort((a, b) => b.year - a.year).map(toYearGroup);
}
