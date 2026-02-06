import { defineConfig } from "orval";

export default defineConfig({
	api: {
		output: {
			mode: "split",
			target: "src/lib/api/generated/index.ts",
			workspace: "src/lib/api/generated",
			schemas: "src/lib/api/generated/models",
			client: "react-query",
			override: {
				mutator: {
					path: "../apiClient.ts",
					name: "authorizedFetcher",
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
