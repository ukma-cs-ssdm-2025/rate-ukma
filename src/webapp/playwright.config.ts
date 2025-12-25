import { defineConfig, devices } from "@playwright/test";

const isCI = process.env.CI === "true";
const timeoutMs = 30_000;

const authenticatedProject = {
	dependencies: ["login"],
	testIgnore: "**/login.spec.ts",
	use: {
		storageState: "playwright/.auth/microsoft.json",
	},
};

export default defineConfig({
	testDir: "./tests/e2e",
	fullyParallel: true,
	forbidOnly: isCI,
	retries: isCI ? 2 : 0,
	workers: isCI ? 1 : undefined,
	timeout: timeoutMs * 2,
	expect: {
		timeout: timeoutMs,
	},
	use: {
		baseURL: process.env.BASE_URL || "http://localhost:3000",
		headless: process.env.HEADLESS !== "false",
		screenshot: "only-on-failure",
		actionTimeout: timeoutMs,
		navigationTimeout: timeoutMs,
		trace: isCI ? "on-first-retry" : "off",
		video: isCI ? "on-first-retry" : "off",
	},
	projects: [
		{
			name: "login",
			testMatch: "**/login.spec.ts",
			use: { ...devices["Desktop Chrome"] },
		},
		{
			name: "chromium-auth",
			...authenticatedProject,
			use: { ...authenticatedProject.use, ...devices["Desktop Chrome"] },
		},
	],
	reporter: isCI ? [["html"], ["github"]] : "line",
});
