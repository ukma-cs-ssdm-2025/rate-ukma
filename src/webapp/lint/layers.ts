import type { DummyRuleMap, OxlintOverride } from "oxlint";

export const MAX_LINES = 400;

export const FEATURE_DEPENDENCIES = {
	"course-offerings": ["courses"],
	courses: ["feed", "instructors", "promo"],
	feed: ["notifications"],
	instructors: [],
	notifications: [],
	promo: [],
	ratings: ["courses", "instructors"],
	"ukma-data": [],
} satisfies Record<string, string[]>;

const FEATURES = Object.keys(FEATURE_DEPENDENCIES);

const GENERATED_API = ["@/lib/api/generated", "@/lib/api/generated/**"];

function restrictImports(
	patterns: { group: string[]; message: string; allowTypeImports?: boolean }[],
): DummyRuleMap {
	return { "no-restricted-imports": ["error", { patterns }] };
}

function featureOverride([feature, dependencies]: [
	string,
	string[],
]): OxlintOverride {
	const allowed = new Set([feature, ...dependencies]);
	const banned = FEATURES.filter((other) => !allowed.has(other));
	return {
		files: [`src/features/${feature}/**`],
		rules: restrictImports([
			{
				group: ["@/routes/**"],
				message: "Features never import routes.",
			},
			...(banned.length > 0
				? [
						{
							group: banned.map((other) => `@/features/${other}/**`),
							message: `features/${feature} may import only ${[...allowed].join(", ")}. Move shared code to lib/ or components/, or declare the dependency in lint/layers.ts if it keeps the graph acyclic.`,
						},
					]
				: []),
		]),
	};
}

export const LAYER_OVERRIDES: OxlintOverride[] = [
	{
		files: ["src/routes/**"],
		rules: restrictImports([
			{
				group: GENERATED_API,
				allowTypeImports: true,
				message:
					"A route renders one page from its feature; API calls live in the feature.",
			},
		]),
	},
	{
		files: ["src/routes/**/*.test.{ts,tsx}"],
		rules: { "no-restricted-imports": "off" },
	},
	{
		files: ["src/components/**", "src/lib/**"],
		rules: restrictImports([
			{
				group: ["@/features/**", "@/routes/**"],
				message:
					"components/ and lib/ are shared: they never import features or routes. Pass the feature part in as a prop or slot.",
			},
		]),
	},
	...Object.entries(FEATURE_DEPENDENCIES).map(featureOverride),
];
