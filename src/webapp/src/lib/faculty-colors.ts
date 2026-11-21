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

const COLOR_CLASS_MAP = {
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
} satisfies Record<string, Omit<ColorConfig, "hex">>;

const FACULTY_COLORS = new Map<string, ColorConfig>(
	Object.entries(FACULTY_COLOR_MAP).map(([faculty, { color, hex }]) => [
		faculty,
		{ ...COLOR_CLASS_MAP[color], hex },
	]),
);

const FALLBACK_COLORS: ColorConfig = {
	...COLOR_CLASS_MAP.gray,
	hex: "#6b7280",
};

export function getFacultyColors(facultyName: string): ColorConfig {
	return FACULTY_COLORS.get(facultyName) ?? FALLBACK_COLORS;
}

export function getFacultyHexColor(facultyName: string): string {
	return getFacultyColors(facultyName).hex;
}

export function getFacultyContrastTextColor(
	hex: string,
): "#ffffff" | "#1a1a1a" {
	const match = /^#([\dA-Fa-f]{6})$/.exec(hex.trim());
	if (!match?.[1]) {
		return "#ffffff";
	}

	const channels = [0, 2, 4].map((offset) => {
		const channel =
			Number.parseInt(match[1].slice(offset, offset + 2), 16) / 255;
		return channel <= 0.03928
			? channel / 12.92
			: ((channel + 0.055) / 1.055) ** 2.4;
	});

	const [red = 0, green = 0, blue = 0] = channels;
	const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
	return luminance > 0.179 ? "#1a1a1a" : "#ffffff";
}

export interface FacultyAccent {
	background: string;
	foreground: string;
}

export function getFacultyAccent(
	facultyName: string | null | undefined,
): FacultyAccent | null {
	if (!facultyName) {
		return null;
	}
	const background = getFacultyHexColor(facultyName);
	return { background, foreground: getFacultyContrastTextColor(background) };
}
