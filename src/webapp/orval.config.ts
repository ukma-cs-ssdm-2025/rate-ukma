import { defineConfig } from "orval";

export default defineConfig({
	api: {
		output: {
			mode: "split",
			target: "endpoints.ts",
			workspace: "src/lib/api/generated",
			schemas: "models",
			client: "react-query",
			httpClient: "axios",
			override: {
				mutator: {
					path: "../apiClient.ts",
					name: "authorizedFetcher",
				},
				// Generate infinite-query hooks for the paginated list endpoints.
				// Scoped per-operation so other list endpoints keep their
				// standard useQuery output.
				operations: {
					instructors_list: {
						query: {
							useInfinite: true,
							useInfiniteQueryParam: "page",
						},
					},
					feed_list: {
						query: {
							useInfinite: true,
							useInfiniteQueryParam: "cursor",
						},
					},
				},
			},
			// Do not generate MSW mocks
			mock: false,
		},
		input: {
			target: "../../docs/api/openapi-generated.yaml",
		},
	},
});
