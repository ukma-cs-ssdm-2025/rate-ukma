import { defineConfig } from "vitest/config";

import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			"@": resolve(__dirname, "./src"),
		},
	},
	test: {
		environment: "jsdom",
		include: ["src/**/*.test.{ts,tsx}"],
		exclude: ["tests/e2e/**"],
		setupFiles: ["./src/vitest.setup.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			exclude: [
				"**/*.test.{ts,tsx}",
				"**/*.config.{ts,js}",
				"**/test-utils/**",
				"**/lib/api/generated/**",
			],
		},
	},
});
