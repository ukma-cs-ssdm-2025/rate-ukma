/**
 * Faculty color mappings for NaUKMA
 * Each faculty has a unique color for visual distinction
 */

export const FACULTY_COLORS = {
	"Факультет інформатики": {
		bg: "bg-purple-100",
		text: "text-purple-700",
		border: "border-purple-300",
		hex: "#4c217a",
	},
	"Факультет економічних наук": {
		bg: "bg-orange-100",
		text: "text-orange-700",
		border: "border-orange-300",
		hex: "#ed6d40",
	},
	"Факультет правничих наук": {
		bg: "bg-rose-100",
		text: "text-rose-700",
		border: "border-rose-300",
		hex: "#870825",
	},
	"Факультет гуманітарних наук": {
		bg: "bg-blue-100",
		text: "text-blue-700",
		border: "border-blue-300",
		hex: "#0076b3",
	},
	"Факультет природничих наук": {
		bg: "bg-green-100",
		text: "text-green-700",
		border: "border-green-300",
		hex: "#006e31",
	},
	"Факультет соціальних наук та соціальних технологій": {
		bg: "bg-yellow-100",
		text: "text-yellow-700",
		border: "border-yellow-300",
		hex: "#f6b213",
	},
	"Факультет охорони здоров'я": {
		bg: "bg-amber-100",
		text: "text-amber-700",
		border: "border-amber-300",
		hex: "#f6b213",
	},
} as const;

export type FacultyName = keyof typeof FACULTY_COLORS;
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
