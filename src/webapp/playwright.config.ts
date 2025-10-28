import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/e2e",
	use: {
		baseURL: process.env.BASE_URL || "http://localhost:3000",
		headless: process.env.CI === "true",
		screenshot: "only-on-failure",
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	reporter: process.env.CI === "true" ? "html" : "line",
});
