import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// https://vitejs.dev/config/
export default defineConfig(() => {
	return {
		plugins: [
			tanstackRouter({ autoCodeSplitting: true }),
			viteReact(),
			tailwindcss(),
		],
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
		},
	};
});
