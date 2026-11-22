export interface ScopeNeed {
	area: string;
	scope: string;
	accepted: readonly string[];
}

export const SCOPE_NEEDS: readonly ScopeNeed[] = [
	{ area: "зміни з САЗ", scope: "catalog:read", accepted: ["catalog:read"] },
	{
		area: "справи",
		scope: "review:read",
		accepted: ["review:read", "review:decide"],
	},
];

export const missingScopes = (scopes: readonly string[]): ScopeNeed[] =>
	SCOPE_NEEDS.filter(
		(need) => !need.accepted.some((scope) => scopes.includes(scope)),
	);
