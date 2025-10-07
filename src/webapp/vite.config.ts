import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	
	return {
		plugins: [
			TanStackRouterVite({ autoCodeSplitting: true }),
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
			outDir: env.STATIC_ROOT || "dist",
			assetsDir: "assets",
			manifest: true,
			copyPublicDir: true,
		},
	};
});
