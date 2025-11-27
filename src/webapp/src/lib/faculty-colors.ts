/**
 * Faculty color mappings for NaUKMA
 * Maps faculty names to their Tailwind color names and brand hex colors
 */

const FACULTY_COLOR_MAP = {
	"1238e786-c7c4-479e-beb8-86c4ccbccabe": {
		// ФІ
		color: "purple",
		hex: "#4c217a",
	},
	"83d46c0a-5898-445e-88f2-35fa36e903e0": {
		// ФЕН
		color: "orange",
		hex: "#ed6d40",
	},
	"0c67c4b7-6ee9-4baa-ac22-4ebf0da4503d": {
		// ФПвН
		color: "rose",
		hex: "#870825",
	},
	"cfebfcf8-3666-440d-b7bf-c89687de702e": {
		// ФГН
		color: "blue",
		hex: "#0076b3",
	},
	"67db5509-b30f-4baa-aafd-a19515a424e4": {
		// ФПрН
		color: "green",
		hex: "#006e31",
	},
	"0c6d2857-d77e-442b-9c80-ebbfba0352f8": {
		// ФСНСТ
		color: "yellow",
		hex: "#f6b213",
	},
	"c1c516fa-4e06-4618-8864-d7252c2db253": {
		// ФОЗ
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
