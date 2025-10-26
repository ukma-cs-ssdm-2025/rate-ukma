import type { AxiosResponse } from "axios";

import {
	useCoursesFilterOptionsRetrieve,
	useCoursesList,
} from "@/lib/api/generated";
import type {
	CourseList,
	CourseListResponse,
	CoursesListParams,
	FilterOptions,
} from "@/lib/api/generated";

const DEFAULT_PAGE_SIZE = 20;

export type CourseQueryFilters = Partial<CoursesListParams>;

const normalizeCoursesResponse = (
	response?: AxiosResponse<CourseListResponse[]>,
): CourseListResponse | undefined => {
	if (!response?.data) {
		return undefined;
	}

	const payload = Array.isArray(response.data) ? response.data[0] : response.data;
	if (!payload) {
		return undefined;
	}

	return {
		...payload,
		items: (payload.items ?? []) as CourseList[],
		filters: (payload.filters ??
			{}) as CourseListResponse["filters"],
	};
};

export function useCourses(filters: CourseQueryFilters = {}) {
	const params: CoursesListParams = {
		...filters,
		page_size: filters.page_size ?? DEFAULT_PAGE_SIZE,
	};

	return useCoursesList<CourseListResponse | undefined>(params, {
		query: {
			select: normalizeCoursesResponse,
		},
	});
}

export function useFilterOptions() {
	return useCoursesFilterOptionsRetrieve<FilterOptions | undefined>({
		query: {
			select: (response) => response?.data ?? undefined,
		},
	});
}
