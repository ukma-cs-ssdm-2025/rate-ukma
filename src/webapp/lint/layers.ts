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

type ImportPattern = {
	group?: string[];
	regex?: string;
	message: string;
	allowTypeImports?: boolean;
};

function escapeRegex(text: string): string {
	return text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

function forbid(
	srcPaths: string[],
	message: string,
	allowTypeImports = false,
): ImportPattern[] {
	const relative = srcPaths.map((path) => path.split("/").at(-1) ?? path);
	return [
		{
			group: srcPaths.flatMap((path) => [`@/${path}`, `@/${path}/**`]),
			message,
			allowTypeImports,
		},
		{
			regex: String.raw`^(\.\./)+(${relative.map(escapeRegex).join("|")})(/|$)`,
			message,
			allowTypeImports,
		},
	];
}

function restrictImports(patterns: ImportPattern[]): DummyRuleMap {
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
			...forbid(["routes"], "Features never import routes."),
			...(banned.length > 0
				? forbid(
						banned.map((other) => `features/${other}`),
						`features/${feature} may import only ${[...allowed].join(", ")}. Move shared code to lib/ or components/, or declare the dependency in lint/layers.ts if it keeps the graph acyclic.`,
					)
				: []),
		]),
	};
}

export const LAYER_OVERRIDES: OxlintOverride[] = [
	{
		files: ["src/routes/**"],
		rules: restrictImports(
			forbid(
				["lib/api/generated"],
				"A route renders one page from its feature; API calls live in the feature.",
				true,
			),
		),
	},
	{
		files: ["src/routes/**/*.test.{ts,tsx}"],
		rules: { "no-restricted-imports": "off" },
	},
	{
		files: ["src/components/**", "src/lib/**"],
		rules: restrictImports(
			forbid(
				["features", "routes"],
				"components/ and lib/ are shared: they never import features or routes. Pass the feature part in as a prop or slot.",
			),
		),
	},
	...Object.entries(FEATURE_DEPENDENCIES).map(featureOverride),
];
