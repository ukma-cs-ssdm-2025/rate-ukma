import { Context, type Effect, Schema } from "effect";
import {
	HttpApi,
	HttpApiEndpoint,
	HttpApiError,
	HttpApiGroup,
	HttpApiMiddleware,
	HttpApiSchema,
	HttpApiSecurity,
	OpenApi,
} from "effect/http-api";
import { Scope } from "../keys/scopes.ts";
import {
	Department,
	Faculty,
	Offering,
	Page,
	PageQuery,
	Programme,
	ReviewCase,
	Term,
} from "../lists/lists.ts";

/** The key behind a request that passed `ApiKeyAuth`. */
export class Caller extends Context.Service<
	Caller,
	{
		readonly keyId: string;
		readonly scopes: ReadonlyArray<Scope>;
		readonly expiresAt: Date;
		/** Rows the response returns, for the audit row. */
		countRows(rows: number): Effect.Effect<void>;
	}
>()("ukma-data/api/Caller") {}

/** The scopes an endpoint behind `ApiKeyAuth` needs, all of them. An endpoint
 *  without this annotation refuses every key. */
export class RequiredScopes extends Context.Service<
	RequiredScopes,
	ReadonlyArray<Scope>
>()("ukma-data/api/RequiredScopes") {}

/** `Authorization: Bearer ukd_...`. An unknown, revoked or expired key or a
 *  wrong secret gets 401; a valid key without a required scope gets 403.
 *  Every request whose key exists writes one audit row, a refused one with
 *  its reason. */
export class ApiKeyAuth extends HttpApiMiddleware.Service<
	ApiKeyAuth,
	{ provides: Caller }
>()("ukma-data/api/ApiKeyAuth", {
	security: { bearer: HttpApiSecurity.bearer },
	error: [HttpApiError.Unauthorized, HttpApiError.Forbidden],
}) {}

export class SystemApi extends HttpApiGroup.make("system", {
	topLevel: true,
})
	.add(
		HttpApiEndpoint.get("health", "/health", {
			success: HttpApiSchema.Empty(200),
		}).annotate(OpenApi.Summary, "Liveness probe, keyless"),
	)
	.annotate(OpenApi.Description, "Probes") {}

export const CurrentKey = Schema.Struct({
	id: Schema.String,
	scopes: Schema.Array(Scope),
	expiresAt: Schema.String,
});

export class KeyApi extends HttpApiGroup.make("key")
	.add(
		HttpApiEndpoint.get("current", "/key", { success: CurrentKey })
			.annotate(RequiredScopes, [])
			.annotate(OpenApi.Summary, "The calling key's id, scopes and expiry"),
	)
	.annotate(OpenApi.Description, "The calling key")
	.middleware(ApiKeyAuth)
	.prefix("/v1") {}

export class CatalogApi extends HttpApiGroup.make("catalog")
	.add(
		HttpApiEndpoint.get("terms", "/terms", {
			query: PageQuery,
			success: Page(Term, "TermPage"),
		}).annotate(OpenApi.Summary, "Terms"),
		HttpApiEndpoint.get("faculties", "/faculties", {
			query: PageQuery,
			success: Page(Faculty, "FacultyPage"),
		}).annotate(OpenApi.Summary, "Faculties"),
		HttpApiEndpoint.get("departments", "/departments", {
			query: PageQuery,
			success: Page(Department, "DepartmentPage"),
		}).annotate(OpenApi.Summary, "Departments"),
		HttpApiEndpoint.get("programmes", "/programmes", {
			query: PageQuery,
			success: Page(Programme, "ProgrammePage"),
		}).annotate(OpenApi.Summary, "Programmes"),
		HttpApiEndpoint.get("offerings", "/offerings", {
			query: PageQuery,
			success: Page(Offering, "OfferingPage"),
		}).annotate(
			OpenApi.Summary,
			"Offerings, each with its terms and programmes",
		),
	)
	.annotate(
		OpenApi.Description,
		"Reference lists and offerings: `catalog:read`",
	)
	.annotateEndpoints(RequiredScopes, ["catalog:read"])
	.middleware(ApiKeyAuth)
	.prefix("/v1") {}

export class ReviewApi extends HttpApiGroup.make("review")
	.add(
		HttpApiEndpoint.get("reviewCases", "/review-cases", {
			query: PageQuery,
			success: Page(ReviewCase, "ReviewCasePage"),
		}).annotate(OpenApi.Summary, "Review cases with their safe answers"),
	)
	.annotate(OpenApi.Description, "Review cases: `review:decide`")
	.annotateEndpoints(RequiredScopes, ["review:decide"])
	.middleware(ApiKeyAuth)
	.prefix("/v1") {}

export class Api extends HttpApi.make("ukma-data")
	.add(SystemApi)
	.add(KeyApi)
	.add(CatalogApi)
	.add(ReviewApi)
	.annotateMerge(
		OpenApi.annotations({
			title: "UKMA Data",
			version: "1",
			license: {
				name: "GPL-3.0-or-later",
				url: "https://www.gnu.org/licenses/gpl-3.0.html",
			},
			servers: [{ url: "/" }],
			description:
				"Every list returns its rows in change-number order, removed rows included. A reader saves one change number per list, asks for `?after=<number>`, stores every page and saves the last page's `cursor` once `hasMore` is false. A bad `after` or `limit` gets 400. New fields may appear in a response without a new version.",
		}),
	) {}
