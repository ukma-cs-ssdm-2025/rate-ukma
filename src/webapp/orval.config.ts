import { defineConfig } from "orval";

export default defineConfig({
	api: {
		output: {
			mode: "split",
			target: "endpoints.ts",
			workspace: "src/lib/api/generated",
			schemas: "models",
			client: "react-query",
			override: {
				mutator: {
					path: "../apiClient.ts",
					name: "authorizedFetcher",
				},
				// Generate an infinite-query hook for the paginated instructors
				// list (page-based). Scoped per-operation so other list
				// endpoints keep their standard useQuery output.
				operations: {
					instructors_list: {
						query: {
							useInfinite: true,
							useInfiniteQueryParam: "page",
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
