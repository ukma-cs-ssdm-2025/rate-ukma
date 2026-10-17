import { authorizedHttpClient } from "@/lib/api/apiClient";
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

// Hand-written until the UKMA Data proxy is in openapi-generated.yaml; then orval generates it.
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

/** Loads the mock on first use, so it stays in its own chunk. */
function lazyMockClient(): UkmaDataClient {
	let loaded: Promise<UkmaDataClient> | undefined;
	const client = () =>
		(loaded ??= import("./mockClient").then((module) =>
			module.createMockClient(),
		));
	return {
		overview: async () => (await client()).overview(),
		reviewCases: async (filter) => (await client()).reviewCases(filter),
		reviewCase: async (id) => (await client()).reviewCase(id),
		decisions: async (filter) => (await client()).decisions(filter),
		decide: async (input) => (await client()).decide(input),
	};
}

// Read import.meta.env, not `env`: Vite folds it at build time and drops the mock chunk.
export const isUkmaDataMocked =
	import.meta.env.VITE_UKMA_DATA_SOURCE === "mock";

export const ukmaDataClient: UkmaDataClient = isUkmaDataMocked
	? lazyMockClient()
	: httpClient;
