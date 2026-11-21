import cloudflare from "@cloudflare/oxlint-config";
import { defineConfig } from "oxlint";

import { LINT_ALLOWLIST } from "./lint/allowlist.ts";
import { LAYER_OVERRIDES, MAX_LINES } from "./lint/layers.ts";

const allowlistOff = process.env.LINT_ALLOWLIST === "off";

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
		"import/no-cycle": "error",
		"max-lines": ["error", { max: MAX_LINES }],
		// Style only: the codebase writes `T[]`; switching buys no safety.
		"typescript/array-type": "off",
		// `import * as React` is the shadcn/ui convention our components follow.
		"import/no-namespace": "off",
		// Sentry captures console output, so logging is how we report (AGENTS.md).
		"no-console": "off",
		// `x == null` is the one loose check we keep: it means null or undefined.
		eqeqeq: ["error", "always", { null: "ignore" }],
		// We check DOM nodes and AxiosHeaders by class; one realm, so it's sound.
		"@nkzw/no-instanceof": "off",
		// Ukrainian copy uses apostrophes; escaping them only hurts reading.
		"react/no-unescaped-entities": "off",
		// React Compiler readiness rules. Each hit needs its own effect
		// redesign, so they are a separate follow-up, not part of this cleanup.
		"react/set-state-in-effect": "off",
		"react/purity": "off",
		"react/refs": "off",
		"react/incompatible-library": "off",
	},
	overrides: [
		...(cloudflare.overrides ?? []),
		{
			// The preset's documented React setting: handlers may return promises,
			// and must handle their own rejections.
			files: ["**/*.tsx"],
			rules: {
				"typescript/no-misused-promises": [
					"error",
					{ checksVoidReturn: { attributes: false } },
				],
			},
		},
		{
			files: [
				"**/*.test.{ts,tsx}",
				"src/test-utils/**",
				"src/vitest.setup.ts",
				"tests/**",
			],
			rules: {
				// Tests stub hooks with vi.fn() and cast the stub to the hook's type.
				// Replacing those seams is its own change; app code stays strict.
				"typescript/no-unsafe-type-assertion": "off",
				"quality/no-chained-type-assertions": "off",
				// vitest 4 constructs class mocks with `new`, which arrows can't do.
				"prefer-arrow-callback": "off",
				"unicorn/consistent-function-scoping": "off",
				// vi.mock's importOriginal<typeof import("...")>() is the documented pattern.
				"typescript/consistent-type-imports": "off",
				// Mocks and fixtures handle untyped payloads (postDataJSON, stubbed
				// globals, fake route options) on purpose; typing them proves nothing.
				"typescript/no-unsafe-assignment": "off",
				"typescript/no-unsafe-member-access": "off",
				"typescript/no-unsafe-call": "off",
				"typescript/no-unsafe-return": "off",
				"typescript/no-non-null-assertion": "off",
				"quality/no-object-parameters": "off",
				"quality/no-unsafe-dictionary-type": "off",
				"quality/no-unknown-returns": "off",
				"quality/no-conditional-empty-object-spread": "off",
				// `await new Promise((r) => setTimeout(r, ms))` is the usual test wait.
				"no-promise-executor-return": "off",
				// tsrs beta flags casts tests need (`{ onLine } as Navigator`).
				"typescript/no-unnecessary-type-assertion": "off",
				"quality/no-known-value-widening": "off",
				"quality/no-array-filter-map": "off",
			},
		},
		{
			// Playwright fixtures call `use()`, which is not React's hook.
			files: ["tests/**"],
			rules: { "react-hooks/rules-of-hooks": "off" },
		},
		...LAYER_OVERRIDES,
		...(allowlistOff
			? []
			: Object.entries(LINT_ALLOWLIST)
					.filter(([, files]) => files.length > 0)
					.map(([rule, files]) => ({
						files,
						rules: { [rule]: "off" as const },
					}))),
	],
});
