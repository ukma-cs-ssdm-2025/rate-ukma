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

// Explicit mapping of color names to Tailwind classes (prevents purging in production)
const COLOR_CLASS_MAP: Record<string, Omit<ColorConfig, "hex">> = {
	purple: {
		bg: "bg-purple-100",
		text: "text-purple-700",
		border: "border-purple-300",
	},
	orange: {
		bg: "bg-orange-100",
		text: "text-orange-700",
		border: "border-orange-300",
	},
	rose: {
		bg: "bg-rose-100",
		text: "text-rose-700",
		border: "border-rose-300",
	},
	blue: {
		bg: "bg-blue-100",
		text: "text-blue-700",
		border: "border-blue-300",
	},
	green: {
		bg: "bg-green-100",
		text: "text-green-700",
		border: "border-green-300",
	},
	yellow: {
		bg: "bg-yellow-100",
		text: "text-yellow-700",
		border: "border-yellow-300",
	},
	teal: {
		bg: "bg-teal-100",
		text: "text-teal-700",
		border: "border-teal-300",
	},
	gray: {
		bg: "bg-gray-100",
		text: "text-gray-700",
		border: "border-gray-300",
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
	const colors = FACULTY_COLORS[facultyName as FacultyName];

	if (!colors) {
		return {
			bg: "bg-gray-100",
			text: "text-gray-700",
			border: "border-gray-300",
			hex: "#6b7280",
		};
	}

	return colors;
}

/**
 * Get hex color for a faculty (useful for charts/graphs)
 */
export function getFacultyHexColor(facultyName: string): string {
	return getFacultyColors(facultyName).hex;
}

/**
 * Readable text color for a faculty hex background.
 * Uses WCAG relative luminance so light brand colors (e.g. yellow)
 * get dark text while dark ones keep white text.
 */
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

/**
 * Accent colors for a discipline, or null when no faculty is assigned
 * (callers fall back to the default blue styling in that case).
 */
export function getFacultyAccent(
	facultyName: string | null | undefined,
): FacultyAccent | null {
	if (!facultyName) return null;
	const background = getFacultyHexColor(facultyName);
	return { background, foreground: getFacultyContrastTextColor(background) };
}
