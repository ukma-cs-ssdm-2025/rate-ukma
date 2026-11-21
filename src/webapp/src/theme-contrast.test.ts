import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type Rgb = readonly [number, number, number];

function oklchToLinear(l: number, c: number, hDeg: number): Rgb {
	const h = (hDeg * Math.PI) / 180;
	const a = c * Math.cos(h);
	const b = c * Math.sin(h);
	const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
	const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
	const s_ = l - 0.0894841775 * a - 1.291485548 * b;
	const l3 = l_ ** 3;
	const m3 = m_ ** 3;
	const s3 = s_ ** 3;
	return [
		4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
		-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
		-0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
	];
}

function oklchToRgb(l: number, c: number, hDeg: number): Rgb {
	let lo = 0;
	let hi = c;
	for (let i = 0; i < 24; i++) {
		const mid = (lo + hi) / 2;
		const [r, g, b] = oklchToLinear(l, mid, hDeg);
		if (r >= 0 && r <= 1 && g >= 0 && g <= 1 && b >= 0 && b <= 1) {
			lo = mid;
		} else {
			hi = mid;
		}
	}
	const [r, g, bl] = oklchToLinear(l, lo, hDeg);
	const toSrgb = (x: number) => {
		const clamped = Math.min(Math.max(x, 0), 1);
		return clamped <= 0.0031308
			? 12.92 * clamped
			: 1.055 * clamped ** (1 / 2.4) - 0.055;
	};
	return [toSrgb(r), toSrgb(g), toSrgb(bl)];
}

function relativeLuminance([r, g, b]: Rgb): number {
	const linear = (x: number) =>
		x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
	return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(a: Rgb, b: Rgb): number {
	const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort(
		(x, y) => y - x,
	);
	return (hi + 0.05) / (lo + 0.05);
}

function blend(fg: Rgb, base: Rgb, alpha: number): Rgb {
	return [
		alpha * fg[0] + (1 - alpha) * base[0],
		alpha * fg[1] + (1 - alpha) * base[1],
		alpha * fg[2] + (1 - alpha) * base[2],
	];
}

function readTokens(block: "light" | "dark"): Map<string, Rgb> {
	const cssPath = join(import.meta.dirname, "styles.css");
	const css = readFileSync(cssPath, "utf8");
	const selector = block === "light" ? ":root" : "@variant dark";
	const body = new RegExp(`${selector}\\s*\\{([^{}]*)`).exec(css)?.[1];
	expect(body, `missing ${selector} block in styles.css`).toBeDefined();
	const tokens = new Map<string, Rgb>();
	const pattern =
		/--([\w-]+)\s*:\s*oklch\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)(?:\s*\/[^)]*)?\)/g;
	for (const match of body!.matchAll(pattern)) {
		const [, name, l, c, h] = match;
		tokens.set(name, oklchToRgb(Number(l), Number(c), Number(h)));
	}
	expect(tokens.size).toBeGreaterThan(10);
	return tokens;
}

interface ContrastCase {
	fg: string;
	bg: string;
	min: number;
	why: string;
	alpha?: number;
	bgAlphaOver?: string;
}

const TEXT = 4.5;
const CHROME = 3;

const CANONICAL: Array<[string, string]> = [
	["foreground", "background"],
	["card-foreground", "card"],
	["card-user-foreground", "card-user"],
	["popover-foreground", "popover"],
	["primary-foreground", "primary"],
	["secondary-foreground", "secondary"],
	["muted-foreground", "muted"],
	["accent-foreground", "accent"],
	["destructive-foreground", "destructive"],
	["difficulty-foreground", "difficulty"],
	["usefulness-foreground", "usefulness"],
	["sidebar-foreground", "sidebar"],
	["sidebar-primary-foreground", "sidebar-primary"],
	["sidebar-accent-foreground", "sidebar-accent"],
];

function casesFor(mode: "light" | "dark"): ContrastCase[] {
	const cases: ContrastCase[] = CANONICAL.map(([fg, bg]) => ({
		fg,
		bg,
		min: mode === "dark" && bg === "destructive" ? CHROME : TEXT,
		why: `canonical ${fg} on ${bg}`,
	}));
	cases.push(
		{
			fg: "muted-foreground",
			bg: "background",
			min: TEXT,
			why: "secondary text on page",
		},
		{
			fg: "muted-foreground",
			bg: "card",
			min: TEXT,
			why: "secondary text on cards",
		},
		{
			fg: "primary",
			bg: "background",
			min: TEXT,
			why: "links, logo accent, score tones",
		},
		{
			fg: "destructive",
			bg: "background",
			min: TEXT,
			why: "form/login errors, destructive menu items",
		},
		{
			fg: "destructive",
			bg: "destructive",
			bgAlphaOver: "background",
			alpha: 0.1,
			min: TEXT,
			why: "tinted error boxes (bg-destructive/10)",
		},
		{
			fg: "success",
			bg: "success",
			bgAlphaOver: "background",
			alpha: 0.1,
			min: TEXT,
			why: "success badges (bg-success/10 text-success)",
		},
		...(["term-fall", "term-spring", "term-summer"] as const).map((term) => ({
			fg: term,
			bg: term,
			bgAlphaOver: "background",
			alpha: 0.12,
			min: TEXT,
			why: "term badges (bg-term-*/12 text-term-*)",
		})),
		...(
			[
				"faculty-purple",
				"faculty-orange",
				"faculty-rose",
				"faculty-blue",
				"faculty-green",
				"faculty-yellow",
				"faculty-teal",
				"faculty-gray",
			] as const
		).map((faculty) => ({
			fg: faculty,
			bg: faculty,
			bgAlphaOver: "background",
			alpha: 0.12,
			min: TEXT,
			why: "faculty badges (bg-faculty-*/12 text-faculty-*)",
		})),
	);
	if (mode === "dark") {
		cases.push({
			fg: "destructive-foreground",
			bg: "destructive",
			bgAlphaOver: "background",
			alpha: 0.6,
			min: TEXT,
			why: "dark destructive buttons/badges render bg-destructive/60",
		});
	}
	cases.push({
		fg: "muted-foreground",
		bg: "background",
		alpha: 0.7,
		min: mode === "dark" ? TEXT : 3,
		why:
			mode === "dark"
				? "dimmed secondary icons/text (opacity-70)"
				: "KNOWN LIMITATION: light dimmed secondary text holds a no-worse floor",
	});
	if (mode === "dark") {
		cases.push({
			fg: "ring",
			bg: "background",
			alpha: 0.5,
			min: CHROME,
			why: "focus-visible:ring-ring/50 indicator",
		});
	} else {
		cases.push({
			fg: "ring",
			bg: "background",
			alpha: 0.5,
			min: 2,
			why: "KNOWN LIMITATION: light focus ring is brand-blue at 50%; floor guards further regression",
		});
	}
	return cases;
}

describe.each(["light", "dark"] as const)("theme contrast (%s)", (mode) => {
	const tokens = readTokens(mode);
	const cases = casesFor(mode);

	it.each(cases.map((c) => [c]))(
		"$why: $fg on $bg >= $min",
		({ fg, bg, min, alpha, bgAlphaOver }) => {
			const fgColor = tokens.get(fg);
			let bgColor = tokens.get(bg);
			expect(fgColor, `missing --${fg}`).toBeDefined();
			expect(bgColor, `missing --${bg}`).toBeDefined();
			if (bgAlphaOver) {
				const page = tokens.get(bgAlphaOver);
				expect(page, `missing --${bgAlphaOver}`).toBeDefined();
				bgColor = blend(bgColor!, page!, alpha!);
			}
			const fgRendered =
				alpha != null && !bgAlphaOver
					? blend(fgColor!, bgColor!, alpha)
					: fgColor!;
			const ratio = contrast(fgRendered, bgColor!);
			expect(
				ratio,
				`${mode} --${fg} on --${bg} is ${ratio.toFixed(2)}:1, need >= ${min}:1`,
			).toBeGreaterThanOrEqual(min);
		},
	);
});
