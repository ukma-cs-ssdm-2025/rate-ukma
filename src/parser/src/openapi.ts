import { writeFileSync } from "node:fs";
import { OPENAPI_FILE, openApiJson } from "./api/openapi.ts";

writeFileSync(OPENAPI_FILE, openApiJson());
