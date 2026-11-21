import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const rawEnv = createEnv({
	server: {},

	clientPrefix: "VITE_",

	client: {
		VITE_API_BASE_URL: z.url().default("http://localhost:8000"),
		VITE_SENTRY_DSN_FRONTEND: z.string().optional(),
		VITE_ENVIRONMENT: z
			.enum(["development", "staging", "live"])
			.default("development"),
	},

	runtimeEnv: import.meta.env,

	emptyStringAsUndefined: true,
});

export const env = {
	...rawEnv,
	VITE_SKIP_OFFLINE_CHECK:
		import.meta.env.MODE !== "production" &&
		rawEnv.VITE_API_BASE_URL.includes("localhost"),
};
