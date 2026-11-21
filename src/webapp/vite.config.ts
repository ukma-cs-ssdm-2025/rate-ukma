import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import type { Plugin, PluginOption } from "vite";

import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";

import {
	APP_NAME,
	DEFAULT_PAGE_DESCRIPTION,
	DEFAULT_PAGE_TITLE,
} from "./src/lib/site-metadata";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const escapeHtml = (value: string) =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");

const siteMetadataPlugin: Plugin = {
	name: "rate-ukma-site-metadata",
	transformIndexHtml: {
		order: "pre",
		handler: (html) =>
			html
				.replaceAll("%APP_NAME%", escapeHtml(APP_NAME))
				.replaceAll("%DEFAULT_PAGE_TITLE%", escapeHtml(DEFAULT_PAGE_TITLE))
				.replaceAll(
					"%DEFAULT_PAGE_DESCRIPTION%",
					escapeHtml(DEFAULT_PAGE_DESCRIPTION),
				),
	},
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
	const isProduction = mode === "production";

	const plugins: PluginOption[] = [
		siteMetadataPlugin,
		tanstackRouter({ autoCodeSplitting: true }),
		viteReact(),
		tailwindcss(),
	];

	// Upload sourcemaps to Sentry in production builds (if auth token is provided)
	if (isProduction && process.env.SENTRY_AUTH_TOKEN) {
		plugins.push(
			sentryVitePlugin({
				org: process.env.SENTRY_ORG,
				project: process.env.SENTRY_PROJECT_FRONTEND,
				authToken: process.env.SENTRY_AUTH_TOKEN,
				sourcemaps: {
					assets: "./dist/**",
					// Delete sourcemaps after uploading to Sentry
					filesToDeleteAfterUpload: ["./dist/**/*.map"],
				},
				// Don't create releases here - handle that separately in CI
				telemetry: false,
			}),
		);
	}

	return {
		plugins,
		resolve: {
			alias: {
				"@": resolve(__dirname, "./src"),
			},
		},
		base: "/",
		build: {
			outDir: "dist",
			assetsDir: "assets",
			manifest: true,
			copyPublicDir: true,
			// Generate hidden sourcemaps in production (not referenced in built files)
			sourcemap: isProduction ? "hidden" : false,
		},
	};
});
