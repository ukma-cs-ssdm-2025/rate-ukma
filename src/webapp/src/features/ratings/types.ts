import type { StudentRatingsDetailed } from "@/lib/api/generated";

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
