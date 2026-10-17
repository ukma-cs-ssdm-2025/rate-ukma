import { Schema } from "effect";

/** What a key may do (spec, Access and personal data). A scope gives only
 *  what it names: `catalog:read` gives no student data. */
export const SCOPES = [
	"catalog:read",
	"runs:read",
	"instructors:read",
	"students:read",
	"runs:start",
	"review:decide",
	"snapshots:read",
	"audit:read",
	"keys:manage",
] as const;

export const Scope = Schema.Literals(SCOPES);

export type Scope = typeof Scope.Type;

export const DEFAULT_SCOPES: ReadonlyArray<Scope> = [
	"catalog:read",
	"runs:read",
];

/** The scopes `required` names that `held` lacks. */
export const missingScopes = (
	held: ReadonlyArray<Scope>,
	required: ReadonlyArray<Scope>,
): ReadonlyArray<Scope> => required.filter((scope) => !held.includes(scope));
