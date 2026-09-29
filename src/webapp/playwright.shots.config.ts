import { defineConfig } from "@playwright/test";

const external = process.env.SHOT_BASE_URL;
const port = 4174;

export default defineConfig({
	testDir: "./tests/shots",
	fullyParallel: true,
	reporter: [["list"]],
	timeout: 60_000,
	use: {
		baseURL: external ?? `http://127.0.0.1:${port}`,
		locale: "uk-UA",
		timezoneId: "Europe/Kyiv",
		contextOptions: { reducedMotion: "reduce" },
	},
	// The bundled preview is much faster to drive than the dev server; the
	// API base URL points at a port nothing listens on, since every call is mocked.
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
