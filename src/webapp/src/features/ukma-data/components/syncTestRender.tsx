import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import type { OnUrlUpdateFunction } from "nuqs/adapters/testing";

import { authorizedHttpClient } from "@/lib/api/apiClient";
import type { SyncSummary } from "@/lib/api/generated";
import { SyncPage } from "./SyncPage";
import { catalogSummary, listPage, SYNC_URL } from "./syncTestData";

export const SUMMARY_URL = `${SYNC_URL}/summary/`;
export const PENDING_URL = `${SYNC_URL}/pending/`;
export const PREVIEW_URL = `${SYNC_URL}/preview/`;
export const APPROVE_URL = `${SYNC_URL}/approve/`;
export const REJECT_URL = `${SYNC_URL}/reject/`;
export const QUESTIONS_URL = `${SYNC_URL}/questions/`;
export const BULK_URL = `${SYNC_URL}/questions/answers/`;
export const answerUrl = (id: number) => `${SYNC_URL}/changes/${id}/answer/`;

export function mockSync(summary: SyncSummary = catalogSummary): MockAdapter {
	const mock = new MockAdapter(authorizedHttpClient);
	mock.onGet(`${SYNC_URL}/approvals/active/`).reply(200, { item: null });
	mock.onGet(`${SYNC_URL}/runs/7/approvals/`).reply(200, listPage([]));
	mock.onGet(SUMMARY_URL).reply(200, summary);
	return mock;
}

export function renderSync(search = "", onUrlUpdate?: OnUrlUpdateFunction) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<NuqsTestingAdapter
				searchParams={search}
				hasMemory
				onUrlUpdate={onUrlUpdate}
			>
				<SyncPage />
			</NuqsTestingAdapter>
		</QueryClientProvider>,
	);
}

export function bodyOf(mock: MockAdapter, url: string): object[] {
	return mock.history.post
		.filter((call) => call.url === url)
		.flatMap((call) => {
			const body: unknown = JSON.parse(String(call.data));
			return typeof body === "object" && body !== null ? [body] : [];
		});
}
