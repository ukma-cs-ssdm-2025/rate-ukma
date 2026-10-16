import { env } from "@/env";
import { authorizedHttpClient } from "@/lib/api/apiClient";
import { createMockClient } from "./mockClient";
import {
	type CaseFilter,
	type Decision,
	decision,
	type DecisionInput,
	type Overview,
	overview,
	pageOf,
	type ReviewCase,
	reviewCase,
} from "./schemas";

export interface UkmaDataClient {
	overview(): Promise<Overview>;
	reviewCases(filter: CaseFilter): Promise<ReviewCase[]>;
	reviewCase(id: string): Promise<ReviewCase>;
	decisions(filter: { reviewCaseId?: string }): Promise<Decision[]>;
	decide(input: DecisionInput): Promise<Decision>;
}

const BASE = "/api/v1/data";

const httpClient: UkmaDataClient = {
	overview: async () =>
		overview.parse((await authorizedHttpClient.get(`${BASE}/overview/`)).data),
	reviewCases: async (filter) =>
		pageOf(reviewCase).parse(
			(
				await authorizedHttpClient.get(`${BASE}/review-cases/`, {
					params: filter,
				})
			).data,
		).items,
	reviewCase: async (id) =>
		reviewCase.parse(
			(await authorizedHttpClient.get(`${BASE}/review-cases/${id}/`)).data,
		),
	decisions: async (filter) =>
		pageOf(decision).parse(
			(await authorizedHttpClient.get(`${BASE}/decisions/`, { params: filter }))
				.data,
		).items,
	decide: async (input) =>
		decision.parse(
			(await authorizedHttpClient.post(`${BASE}/decisions/`, input)).data,
		),
};

export const isUkmaDataMocked =
	(env.VITE_UKMA_DATA_SOURCE ??
		(env.VITE_ENVIRONMENT === "live" ? "api" : "mock")) === "mock";

export const ukmaDataClient: UkmaDataClient = isUkmaDataMocked
	? createMockClient()
	: httpClient;
