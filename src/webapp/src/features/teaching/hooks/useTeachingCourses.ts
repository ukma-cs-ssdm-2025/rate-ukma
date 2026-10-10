import { useQuery } from "@tanstack/react-query";

import { authorizedFetcher } from "@/lib/api/apiClient";
import type { TeachingCourseList } from "../types";

export function useTeachingCourses({
	enabled,
}: Readonly<{ enabled: boolean }>) {
	return useQuery({
		queryKey: ["/api/v1/teachers/me/courses/"],
		queryFn: ({ signal }) =>
			authorizedFetcher<TeachingCourseList>({
				url: "/api/v1/teachers/me/courses/",
				method: "GET",
				signal,
			}),
		enabled,
	});
}
