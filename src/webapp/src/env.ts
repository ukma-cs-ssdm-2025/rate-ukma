import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const rawEnv = createEnv({
	server: {},

	/**
	 * The prefix that client-side variables must have. This is enforced both at
	 * a type-level and at runtime.
	 */
	clientPrefix: "VITE_",

	client: {
		VITE_API_BASE_URL: z.url().default("http://localhost:8000"),
	},

	/**
	 * What object holds the environment variables at runtime. This is usually
	 * `process.env` or `import.meta.env`.
	 */
	runtimeEnv: import.meta.env,

	/**
	 * By default, this library will feed the environment variables directly to
	 * the Zod validator.
	 *
	 * This means that if you have an empty string for a value that is supposed
	 * to be a number (e.g. `PORT=` in a ".env" file), Zod will incorrectly flag
	 * it as a type mismatch violation. Additionally, if you have an empty string
	 * for a value that is supposed to be a string with a default value (e.g.
	 * `DOMAIN=` in an ".env" file), the default value will never be applied.
	 *
	 * In order to solve these issues, we recommend that all new projects
	 * explicitly specify this option as true.
	 */
	emptyStringAsUndefined: true,
});

export const env = {
	...rawEnv,
	/**
	 * Skip offline checks when API is pointing to localhost in non-production mode.
	 * This is useful for local development without internet connection when everything is up locally.
	 */
	VITE_SKIP_OFFLINE_CHECK:
		import.meta.env.MODE !== "production" &&
		rawEnv.VITE_API_BASE_URL.includes("localhost"),
};
