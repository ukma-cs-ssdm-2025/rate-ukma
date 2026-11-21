import cloudflare from "@cloudflare/oxlint-config";
import { defineConfig } from "oxlint";

export default defineConfig({
	...cloudflare,
	ignorePatterns: [
		...(cloudflare.ignorePatterns ?? []),
		"src/routeTree.gen.ts",
		"src/lib/api/generated/**",
		"playwright-report/**",
		"playwright/.auth/**",
		"test-results/**",
	],
	rules: {
		...cloudflare.rules,
		// Style only: the codebase writes `T[]`; switching buys no safety.
		"typescript/array-type": "off",
		// `import * as React` is the shadcn/ui convention our components follow.
		"import/no-namespace": "off",
		// Sentry captures console output, so logging is how we report (AGENTS.md).
		"no-console": "off",
	},
});
