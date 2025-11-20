/**
 * Faculty color mappings for NaUKMA
 * Maps faculty names to their Tailwind color names and brand hex colors
 */

const FACULTY_COLOR_MAP = {
	"Факультет інформатики": { color: "purple", hex: "#4c217a" },
	"Факультет економічних наук": { color: "orange", hex: "#ed6d40" },
	"Факультет правничих наук": { color: "rose", hex: "#870825" },
	"Факультет гуманітарних наук": { color: "blue", hex: "#0076b3" },
	"Факультет природничих наук": { color: "green", hex: "#006e31" },
	"Факультет соціальних наук та соціальних технологій": {
		color: "yellow",
		hex: "#f6b213",
	},
	"Факультет охорони здоров'я, соціальної роботи та психології": {
		color: "teal",
		hex: "#9b338c",
	},
} as const;

type ColorConfig = { bg: string; text: string; border: string; hex: string };

function createColorConfig(color: string, hex: string): ColorConfig {
	return {
		bg: `bg-${color}-100`,
		text: `text-${color}-700`,
		border: `border-${color}-300`,
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
