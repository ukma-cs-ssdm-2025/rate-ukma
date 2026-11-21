const INFORMATICS = "Факультет інформатики";
const ECONOMICS = "Факультет економічних наук";
const LAW = "Факультет правничих наук";
const HUMANITIES = "Факультет гуманітарних наук";
const NATURAL_SCIENCES = "Факультет природничих наук";
const SOCIAL_SCIENCES = "Факультет соціальних наук і соціальних технологій";
const HEALTH = "Факультет охорони здоров`я, соціальної роботи і психології";

export const DOTS = [
	[
		11,
		22,
		"bg-faculty-purple/30",
		"Архітектура обчислювальних систем",
		INFORMATICS,
		4.31,
		3.87,
		41,
	],
	[19, 64, "bg-faculty-orange/30", "Макроекономіка", ECONOMICS, 3.64, 3.12, 19],
	[
		8,
		78,
		"bg-faculty-blue/30",
		"Українська мова за професійним спрямуванням",
		HUMANITIES,
		3.52,
		2.18,
		77,
	],
	[
		26,
		12,
		"bg-faculty-green/35",
		"Загальна фізика",
		NATURAL_SCIENCES,
		3.92,
		4.08,
		13,
	],
	[15, 44, "bg-faculty-rose/25", "Криміналістика", LAW, 4.15, 2.94, 10],
	[
		5,
		52,
		"bg-faculty-yellow/35",
		"Вступ до політичної науки",
		SOCIAL_SCIENCES,
		4.42,
		2.36,
		27,
	],
	[23, 86, "bg-faculty-teal/30", "Загальна психологія", HEALTH, 3.78, 2.61, 16],
	[80, 18, "bg-faculty-rose/25", "Основи права", LAW, 3.46, 2.27, 64],
	[
		91,
		40,
		"bg-faculty-orange/30",
		"Політична економія",
		ECONOMICS,
		3.95,
		2.83,
		23,
	],
	[
		74,
		70,
		"bg-faculty-purple/25",
		"Дискретна математика",
		INFORMATICS,
		4.38,
		4.12,
		36,
	],
	[58, 90, "bg-faculty-teal/35", "Психологія впливу", HEALTH, 4.06, 1.74, 12],
	[
		85,
		58,
		"bg-faculty-green/30",
		"Анатомія та еволюція нервової системи людини",
		NATURAL_SCIENCES,
		4.24,
		4.41,
		24,
	],
	[
		70,
		34,
		"bg-faculty-yellow/35",
		"Етнополітологія",
		SOCIAL_SCIENCES,
		3.33,
		2.52,
		17,
	],
	[
		89,
		10,
		"bg-faculty-rose/30",
		"Міжнародне публічне право",
		LAW,
		4.57,
		3.68,
		20,
	],
	[78, 90, "bg-faculty-blue/25", "Англійська мова", HUMANITIES, 3.71, 2.44, 22],
	[
		38,
		94,
		"bg-faculty-purple/25",
		"Диференціальні рівняння",
		INFORMATICS,
		3.18,
		3.94,
		9,
	],
	[
		61,
		6,
		"bg-faculty-blue/25",
		"Історія української культури",
		HUMANITIES,
		3.87,
		1.92,
		14,
	],
	[
		94,
		80,
		"bg-faculty-yellow/35",
		"Військова соціологія",
		SOCIAL_SCIENCES,
		3.58,
		3.21,
		14,
	],
] as const;

const DOT_REM_PER_SQRT_RATING = 0.5;

export function dotSize(ratingsCount: number) {
	return Math.sqrt(ratingsCount) * DOT_REM_PER_SQRT_RATING;
}
