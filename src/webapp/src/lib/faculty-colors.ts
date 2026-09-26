/**
 * Faculty color mappings for NaUKMA
 * Maps faculty names to their Tailwind color names and brand hex colors
 */

const FACULTY_COLOR_MAP = {
	"Факультет інформатики": {
		color: "purple",
		hex: "#4c217a",
	},
	"Факультет економічних наук": {
		color: "orange",
		hex: "#ed6d40",
	},
	"Факультет правничих наук": {
		color: "rose",
		hex: "#870825",
	},
	"Факультет гуманітарних наук": {
		color: "blue",
		hex: "#0076b3",
	},
	"Факультет природничих наук": {
		color: "green",
		hex: "#006e31",
	},
	"Факультет соціальних наук і соціальних технологій": {
		color: "yellow",
		hex: "#f6b213",
	},
	"Факультет соціальних наук та соціальних технологій": {
		color: "yellow",
		hex: "#f6b213",
	},
	"Факультет охорони здоров`я, соціальної роботи і психології": {
		color: "teal",
		hex: "#9b338c",
	},
} as const;

type ColorConfig = { bg: string; text: string; border: string; hex: string };

// Explicit token classes (prevents purging in production). Each entry tints
// the badge with its faculty token at 12% over the page background and sets
// the text to the token itself, so light and dark modes both read via the
// token values in styles.css (same pattern as TermBadge).
const COLOR_CLASS_MAP: Record<string, Omit<ColorConfig, "hex">> = {
	purple: {
		bg: "bg-faculty-purple/12",
		text: "text-faculty-purple",
		border: "border-transparent",
	},
	orange: {
		bg: "bg-faculty-orange/12",
		text: "text-faculty-orange",
		border: "border-transparent",
	},
	rose: {
		bg: "bg-faculty-rose/12",
		text: "text-faculty-rose",
		border: "border-transparent",
	},
	blue: {
		bg: "bg-faculty-blue/12",
		text: "text-faculty-blue",
		border: "border-transparent",
	},
	green: {
		bg: "bg-faculty-green/12",
		text: "text-faculty-green",
		border: "border-transparent",
	},
	yellow: {
		bg: "bg-faculty-yellow/12",
		text: "text-faculty-yellow",
		border: "border-transparent",
	},
	teal: {
		bg: "bg-faculty-teal/12",
		text: "text-faculty-teal",
		border: "border-transparent",
	},
	gray: {
		bg: "bg-faculty-gray/12",
		text: "text-faculty-gray",
		border: "border-transparent",
	},
};

function createColorConfig(color: string, hex: string): ColorConfig {
	const classes = COLOR_CLASS_MAP[color] ?? COLOR_CLASS_MAP.gray;
	return {
		...classes,
		hex,
	};
}

// Build the full faculty colors object
export const FACULTY_COLORS = Object.entries(FACULTY_COLOR_MAP).reduce(
	(acc, [faculty, { color, hex }]) => {
		acc[faculty] = createColorConfig(color, hex);
		return acc;
	},
	{} as Record<string, ColorConfig>,
);

export type FacultyName = keyof typeof FACULTY_COLOR_MAP;
export function getFacultyColors(facultyName: string) {
	// hasOwn: inherited props (__proto__, toString, …) must fall back to gray.
	const colors = Object.hasOwn(FACULTY_COLORS, facultyName)
		? FACULTY_COLORS[facultyName as FacultyName]
		: undefined;

	if (!colors) {
		return {
			bg: "bg-faculty-gray/12",
			text: "text-faculty-gray",
			border: "border-transparent",
			hex: "#6b7280",
		};
	}

	return colors;
}

/** Get hex color for a faculty (useful for charts/graphs). */
export function getFacultyHexColor(facultyName: string): string {
	return getFacultyColors(facultyName).hex;
}

/** Readable text on a faculty hex background (WCAG luminance). */
export function getFacultyContrastTextColor(
	hex: string,
): "#ffffff" | "#1a1a1a" {
	const match = /^#([\dA-Fa-f]{6})$/.exec(hex.trim());
	if (!match?.[1]) return "#ffffff";

	const channels = [0, 2, 4].map((offset) => {
		const channel =
			Number.parseInt(match[1].slice(offset, offset + 2), 16) / 255;
		return channel <= 0.03928
			? channel / 12.92
			: ((channel + 0.055) / 1.055) ** 2.4;
	});

	const luminance =
		0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
	return luminance > 0.179 ? "#1a1a1a" : "#ffffff";
}

export interface FacultyAccent {
	background: string;
	foreground: string;
}

/** Accent colors, or null when no faculty is assigned (blue fallback). */
export function getFacultyAccent(
	facultyName: string | null | undefined,
): FacultyAccent | null {
	if (!facultyName) return null;
	const background = getFacultyHexColor(facultyName);
	return { background, foreground: getFacultyContrastTextColor(background) };
}
