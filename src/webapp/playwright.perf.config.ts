import { defineConfig } from "@playwright/test";

const external = process.env.PERF_BASE_URL;
const port = 4176;

// Same bundled preview and mocked API as the shots, so numbers measure the
// client alone. Motion is left on: this is what a student's browser does.
export default defineConfig({
	testDir: "./tests/perf",
	workers: 1,
	reporter: [["list"]],
	timeout: 300_000,
	use: {
		baseURL: external ?? `http://127.0.0.1:${port}`,
		locale: "uk-UA",
		timezoneId: "Europe/Kyiv",
	},
	webServer: external
		? undefined
		: {
				command: `vite build && vite preview --port ${port} --strictPort --host 127.0.0.1`,
				url: `http://127.0.0.1:${port}`,
				env: { VITE_API_BASE_URL: "http://localhost:9" },
				reuseExistingServer: false,
				timeout: 120_000,
			},
});
