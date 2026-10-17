import { readFileSync } from "node:fs";
import { assert, describe, it } from "@effect/vitest";
import { OPENAPI_FILE, openApiJson } from "./openapi.ts";

describe("openapi.json", () => {
	it("matches the code; run `pnpm openapi` after an API change", () => {
		assert.strictEqual(readFileSync(OPENAPI_FILE, "utf8"), openApiJson());
	});
});
