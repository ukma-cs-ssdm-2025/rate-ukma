import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { LINT_ALLOWLIST } from "../lint/allowlist.ts";
import { FEATURE_DEPENDENCIES } from "../lint/layers.ts";

const root = join(import.meta.dirname, "..");
const problems: string[] = [];

function lintWithoutAllowlist(): Map<string, Set<string>> {
	const { stdout } = spawnSync("pnpm", ["exec", "oxlint", "-f", "json"], {
		cwd: root,
		env: { ...process.env, LINT_ALLOWLIST: "off" },
		encoding: "utf8",
		maxBuffer: 64 * 1024 * 1024,
	});
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint's own JSON report
	const { diagnostics } = JSON.parse(stdout) as {
		diagnostics: { code?: string; filename: string; message: string }[];
	};
	const filesByRule = new Map<string, Set<string>>();
	for (const { code, filename, message } of diagnostics) {
		if (code === undefined) {
			problems.push(`${filename}: ${message}`);
			continue;
		}
		const [, plugin, name] = /^(.*)\((.*)\)$/.exec(code) ?? [];
		const rule = plugin === "eslint" ? name : `${plugin}/${name}`;
		const files = filesByRule.get(rule) ?? new Set<string>();
		files.add(filename);
		filesByRule.set(rule, files);
	}
	return filesByRule;
}

function checkStaleEntries() {
	const filesByRule = lintWithoutAllowlist();
	for (const [rule, files] of Object.entries(LINT_ALLOWLIST)) {
		for (const file of files) {
			if (!filesByRule.get(rule)?.has(file)) {
				problems.push(
					`${file} no longer breaks ${rule}: remove it from lint/allowlist.ts.`,
				);
			}
		}
	}
}

function checkFeatureGraph() {
	const declared = Object.keys(FEATURE_DEPENDENCIES);
	const onDisk = readdirSync(join(root, "src/features"), {
		withFileTypes: true,
	})
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name);
	for (const feature of onDisk) {
		if (!declared.includes(feature)) {
			problems.push(
				`features/${feature} is missing from FEATURE_DEPENDENCIES in lint/layers.ts.`,
			);
		}
	}
	const graph = new Map<string, string[]>(Object.entries(FEATURE_DEPENDENCIES));
	const done = new Set<string>();
	const visit = (feature: string, path: string[]) => {
		if (path.includes(feature)) {
			problems.push(
				`Feature cycle in lint/layers.ts: ${[...path, feature].join(" -> ")}.`,
			);
			return;
		}
		if (done.has(feature)) {
			return;
		}
		for (const dependency of graph.get(feature) ?? []) {
			visit(dependency, [...path, feature]);
		}
		done.add(feature);
	};
	for (const feature of graph.keys()) {
		visit(feature, []);
	}
}

const INDEX_FILE_EXEMPT_DIRS = new Set(["src/routes", "src/lib/api/generated"]);

function findIndexFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			return INDEX_FILE_EXEMPT_DIRS.has(relative(root, path))
				? []
				: findIndexFiles(path);
		}
		return /^index\.tsx?$/.test(entry.name) ? [relative(root, path)] : [];
	});
}

function checkIndexFiles() {
	const found = findIndexFiles(join(root, "src"));
	for (const file of found) {
		problems.push(`${file}: no barrel index files; import the module itself.`);
	}
}

checkFeatureGraph();
checkIndexFiles();
checkStaleEntries();

if (problems.length > 0) {
	console.error(problems.join("\n"));
	process.exit(1);
}
const sizes = Object.entries(LINT_ALLOWLIST).map(
	([rule, files]) => `${rule} ${files.length}`,
);
console.log(
	`Lint allowlist is current: ${sizes.length > 0 ? sizes.join(", ") : "empty"}.`,
);
