import { OpenApi } from "effect/http-api";
import { Api } from "./Api.ts";

/** The committed `docs/parser-service/openapi.json`, written by `pnpm openapi`. */
export const OPENAPI_FILE = new URL(
	"../../../../docs/parser-service/openapi.json",
	import.meta.url,
);

export const openApiJson = (): string =>
	`${JSON.stringify(OpenApi.fromApi(Api), null, "\t")}\n`;
