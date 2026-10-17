import { Schema } from "effect";

/** What a key may do (spec, Access and personal data). A scope gives only
 *  what it names: `catalog:read` gives no student data. A scope is added with
 *  the first endpoint that needs it, together with a migration that widens
 *  the check on `api_keys.scopes`. */
export const SCOPES = ["catalog:read", "review:decide"] as const;

export const Scope = Schema.Literals(SCOPES);

export type Scope = typeof Scope.Type;

export const DEFAULT_SCOPES: ReadonlyArray<Scope> = ["catalog:read"];

/** The scopes `required` names that `held` lacks. */
export const missingScopes = (
	held: ReadonlyArray<Scope>,
	required: ReadonlyArray<Scope>,
): ReadonlyArray<Scope> => required.filter((scope) => !held.includes(scope));
