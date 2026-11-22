import { useQuery } from "@tanstack/react-query";

import type { SyncQuestion } from "@/lib/api/generated";
import {
	getUkmaDataSyncQuestionsListQueryKey,
	ukmaDataSyncQuestionsList,
} from "@/lib/api/generated";

const PAGE_LIMIT = 100;
const MAX_PAGES = 20;

export interface QuestionFilter {
	kinds: string;
	rated?: boolean;
}

async function allQuestions(filter: QuestionFilter): Promise<SyncQuestion[]> {
	const items: SyncQuestion[] = [];
	let after: string | undefined;
	for (let page = 0; page < MAX_PAGES; page += 1) {
		const response = await ukmaDataSyncQuestionsList({
			source: "catalog",
			kinds: filter.kinds,
			rated: filter.rated,
			limit: PAGE_LIMIT,
			after,
		});
		items.push(...response.items);
		if (response.next_after === null) {
			break;
		}
		after = response.next_after;
	}
	return items;
}

export function useSyncQuestions(filter: QuestionFilter) {
	return useQuery({
		queryKey: [
			...getUkmaDataSyncQuestionsListQueryKey({
				source: "catalog",
				kinds: filter.kinds,
				rated: filter.rated,
			}),
			"all",
		],
		queryFn: () => allQuestions(filter),
		retry: false,
	});
}
