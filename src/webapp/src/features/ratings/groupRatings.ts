import type { RatingFilter } from "@/features/ratings/components/MyRatingsHeader";
import { getSemesterTermDisplay } from "@/features/courses/courseFormatting";
import type { StudentRatingsDetailed } from "@/lib/api/generated";
import type { SemesterGroup, YearGroup } from "./types";

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

export function groupRatingsByYearAndSemester(
	allRatings: StudentRatingsDetailed[],
	filter: RatingFilter = "all",
): YearGroup[] {
	type YearAccumulator = {
		key: string;
		label: string;
		year?: number;
		seasons: Map<string, SemesterGroup>;
	};

	const years = new Map<string, YearAccumulator>();

	for (const course of allRatings) {
		const isRated = Boolean(course.rated);
		const matchesFilter =
			filter === "all" ||
			(filter === "rated" && isRated) ||
			(filter === "unrated" && !isRated);

		const yearValue =
			typeof course.semester?.year === "number"
				? course.semester?.year
				: undefined;
		const seasonRaw = course.semester?.season?.toUpperCase();

		let yearKey: string;
		let yearLabel: string;
		let academicYearStart: number | undefined;

		if (yearValue == null) {
			yearKey = "unknown";
			yearLabel = "Без року";
		} else {
			const { academicYearStart: ayStart, academicYearLabel } = getAcademicYear(
				yearValue,
				seasonRaw,
			);
			academicYearStart = ayStart;
			yearKey = String(ayStart);
			yearLabel = academicYearLabel;
		}

		if (!years.has(yearKey)) {
			years.set(yearKey, {
				key: yearKey,
				label: yearLabel,
				year: academicYearStart,
				seasons: new Map(),
			});
		}

		let seasonKey = "no-semester";
		let seasonLabel = "Без семестра";
		let seasonDescription = "Невідомий рік";

		if (yearValue != null) {
			seasonKey = seasonRaw ?? "no-semester";
			seasonLabel = seasonRaw
				? getSemesterTermDisplay(seasonRaw, "Невідомий семестр")
				: "Семестр не вказано";
			seasonDescription = seasonRaw
				? `Семестр ${seasonLabel.toLowerCase()}`
				: "Без семестра";
		}

		const seasonOrder = TERM_ORDER[seasonRaw ?? ""] ?? 99;

		const yearEntry = years.get(yearKey);
		if (yearEntry) {
			if (!yearEntry.seasons.has(seasonKey)) {
				yearEntry.seasons.set(seasonKey, {
					key: `${yearKey}-${seasonKey}`,
					label: seasonLabel,
					description: seasonDescription,
					items: [],
					order: seasonOrder,
					ratedCount: 0,
					totalCount: 0,
					unratedRateableCount: 0,
					year: yearValue,
					seasonRaw: seasonRaw,
				});
			}

			const seasonGroup = yearEntry.seasons.get(seasonKey);
			if (seasonGroup) {
				seasonGroup.totalCount++;
				if (isRated) {
					seasonGroup.ratedCount++;
				} else if (course.can_rate) {
					seasonGroup.unratedRateableCount++;
				}

				if (matchesFilter) {
					seasonGroup.items.push(course);
				}
			}
		}
	}

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

			const yearTotal = seasons.reduce((acc, s) => acc + s.totalCount, 0);
			const yearRated = seasons.reduce((acc, s) => acc + s.ratedCount, 0);

			return {
				key: year.key,
				label: year.label,
				year: year.year,
				seasons,
				total: yearTotal,
				ratedCount: yearRated,
			};
		})
		.filter((year) => year.seasons.length > 0);
}
