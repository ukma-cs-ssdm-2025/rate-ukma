import {
	HttpApi,
	HttpApiEndpoint,
	HttpApiGroup,
	HttpApiSchema,
} from "effect/http-api";

export class SystemApi extends HttpApiGroup.make("system", {
	topLevel: true,
}).add(
	HttpApiEndpoint.get("health", "/health", {
		success: HttpApiSchema.Empty(200),
	}),
) {}

export class Api extends HttpApi.make("ukma-data").add(SystemApi) {}
