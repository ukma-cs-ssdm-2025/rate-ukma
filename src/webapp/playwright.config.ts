import { defineConfig, devices } from "@playwright/test";

const authenticatedProject = {
	dependencies: ["login"],
	testIgnore: "**/login.test.ts",
	use: {
		storageState: "playwright/.auth/microsoft.json",
	},
};

export default defineConfig({
	testDir: "./tests/e2e",
	use: {
		baseURL: process.env.BASE_URL || "http://localhost:3000",
		headless: process.env.CI === "true",
		screenshot: "only-on-failure",
	},
	projects: [
		{
			name: "login",
			testMatch: "**/login.test.ts",
			use: { ...devices["Desktop Chrome"] },
		},
		{
			name: "chromium-auth",
			...authenticatedProject,
			use: { ...authenticatedProject.use, ...devices["Desktop Chrome"] },
		},
	],
	reporter: process.env.CI === "true" ? "html" : "line",
});
