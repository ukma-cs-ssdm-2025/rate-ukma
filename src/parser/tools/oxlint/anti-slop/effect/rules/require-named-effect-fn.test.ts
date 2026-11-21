import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "../../../../..");
const pluginPath = join(here, "../index.ts");
const oxlint = join(packageRoot, "node_modules/.bin/oxlint");

let dir: string;

beforeAll(() => {
	dir = mkdtempSync(join(tmpdir(), "named-effect-fn-"));
	writeFileSync(
		join(dir, ".oxlintrc.json"),
		JSON.stringify({
			jsPlugins: [{ name: "anti-slop-effect", specifier: pluginPath }],
			rules: { "anti-slop-effect/require-named-effect-fn": "error" },
		}),
	);
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** The messages the rule reports for `source` saved as `file`. */
const lint = (source: string, file = "sample.ts"): ReadonlyArray<string> => {
	const path = join(dir, file);

	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, source);

	let output = "";

	try {
		output = execFileSync(
			oxlint,
			["-c", join(dir, ".oxlintrc.json"), "--format", "json", path],
			{ encoding: "utf8", cwd: dir },
		);
	} catch (error) {
		output = (error as { stdout: string }).stdout;
	}

	const report = JSON.parse(output) as {
		diagnostics: ReadonlyArray<{ message: string; code: string }>;
	};

	return report.diagnostics
		.filter(({ code }) => code.includes("require-named-effect-fn"))
		.map(({ message }) => message);
};

describe("require-named-effect-fn", () => {
	describe("span name shape", () => {
		it("accepts Effect.fn and Effect.withSpan names of the form Module.function", () => {
			expect(
				lint(`
					const crawl = Effect.fn("Crawl.crawl")(function* () {});
					const x = effect.pipe(Effect.withSpan("Keys.create"));
					const y = Effect.withSpan(effect, "Offerings.reparse");
				`),
			).toEqual([]);
		});

		it.each([
			["crawlRun", "Effect.fn"],
			["crawl.finishRun", "Effect.fn"],
			["Crawl.FinishRun", "Effect.fn"],
			["Crawl.finish.run", "Effect.fn"],
			["event test", "Effect.withSpan"],
			["keys.create", "Effect.withSpan"],
		])("rejects %s in %s", (name, callee) => {
			const source =
				callee === "Effect.fn"
					? `Effect.fn("${name}")(function* () {});`
					: `effect.pipe(Effect.withSpan("${name}"));`;

			expect(lint(source)).toEqual([
				expect.stringContaining(`Span name "${name}" must be`),
			]);
		});
	});

	describe("bound name", () => {
		it("accepts a span whose function part equals the variable", () => {
			expect(
				lint(`const finishRun = Effect.fn("Crawl.finishRun")(function* () {});`),
			).toEqual([]);
		});

		it("rejects a span whose function part differs from the variable", () => {
			expect(
				lint(`const finish = Effect.fn("Crawl.finishRun")(function* () {});`),
			).toEqual([expect.stringContaining("must end in the name")]);
		});
	});

	describe("Effect.fnUntraced", () => {
		const source = `const x = Effect.fnUntraced(function* () {});`;

		it.each(["CrawlStore.ts", "crawl.test.ts", "src/offerings/testing.ts"])(
			"is allowed in %s",
			(file) => {
				expect(lint(source, file)).toEqual([]);
			},
		);

		it("is rejected in other files", () => {
			expect(lint(source, "crawl.ts")).toEqual([
				expect.stringContaining("`Effect.fnUntraced` is for"),
			]);
		});

		it("is allowed elsewhere under a disable comment", () => {
			expect(
				lint(
					`// oxlint-disable-next-line anti-slop-effect/require-named-effect-fn -- the store spans cover it.\n${source}`,
					"crawl.ts",
				),
			).toEqual([]);
		});
	});

	describe("existing checks", () => {
		it("rejects an unnamed Effect.fn", () => {
			expect(lint(`const x = Effect.fn(function* () {});`)).toEqual([
				expect.stringContaining("Pass the span name first"),
			]);
		});

		it("rejects a named function that only returns Effect.gen", () => {
			expect(
				lint(`const x = () => Effect.gen(function* () {});`),
			).toEqual([expect.stringContaining("only returns `Effect.gen`")]);
		});
	});
});
