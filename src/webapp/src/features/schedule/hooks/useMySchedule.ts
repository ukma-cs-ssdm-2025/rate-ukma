import { useQuery } from "@tanstack/react-query";

import { authorizedHttpClient } from "@/lib/api/apiClient";
import type { MySchedule } from "../scheduleTypes";

export function useMySchedule({ enabled }: Readonly<{ enabled: boolean }>) {
	return useQuery({
		queryKey: ["schedule", "me"],
		queryFn: async ({ signal }) => {
			const response = await authorizedHttpClient.get<MySchedule>(
				"/api/v1/schedule/me/",
				{ signal },
			);
			return response.data;
		},
		enabled,
	});
}
