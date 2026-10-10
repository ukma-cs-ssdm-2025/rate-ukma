/**
 * /api/me fixtures. The ІНП mirrors fixtures/saz/inp-2026.json (real course
 * ids and titles, САЗ's typo included); the people are invented test users.
 */

export interface MeFixture {
	user: { name: string; email: string; avatar?: boolean };
	icsToken: string;
	feedFetchedAt?: string | null;
	feedClient?: string | null;
	programme?: { name: string; grade: number } | null;
	inp: Array<{
		courseId: string;
		title: string;
		match?: string;
		variantLabel?: string;
	}>;
	plan: {
		picked: string[];
		selection: Record<string, string>;
		registered: Record<string, string>;
		hidden: string[];
		shortNames?: boolean;
		overrides?: Record<
			string,
			{ day: string; slot: string; room?: string; weeks?: number[] }
		>;
		custom?: Array<{
			id: string;
			name: string;
			day: string;
			slot: string;
			weeks: number[];
			room?: string;
			teacher?: string;
			courseId?: string;
		}>;
		locked?: boolean;
		sazSyncedAt: string | null;
	};
}

export const INP_FIXTURE: MeFixture["inp"] = [
	{ courseId: "362864", title: "Психологія соціального впливу та успіху" },
	{ courseId: "365117", title: "Інформаційна безпека цільових систем" },
	{ courseId: "365128", title: "Технології на війні" },
	{ courseId: "365177", title: "Кваліфікаційна робота" },
	{ courseId: "365181", title: "Інтелектуальні мережі" },
	{ courseId: "366685", title: "Теорія ігор" },
	{
		courseId: "367003",
		title: "Багатозадачне та паралельне пограмування",
		match: "Багатозадачне та паралельне програмування",
		variantLabel: "Комп'ютерні науки БП-4",
	},
	{
		courseId: "367899",
		title: "Генеративний ШІ в розробці програмного забезпечення",
		match: "Генеративний ШІ в розробці програмного забезпеченн",
	},
];

const emptyPlan = (): MeFixture["plan"] => ({
	picked: [],
	selection: {},
	registered: {},
	hidden: [],
	sazSyncedAt: null,
});

/** First visit: signed in, ІНП present, nothing planned yet. */
export const ME_FIRST_VISIT: MeFixture = {
	user: { name: "Тарас Демо", email: "test@example.invalid" },
	icsToken: "first-visit-feed-token",
	programme: { name: "Комп'ютерні науки", grade: 4 },
	inp: INP_FIXTURE,
	plan: emptyPlan(),
};

/** Returning student: full draft saved, САЗ answers partly disagree. */
export const ME_RETURNING: MeFixture = {
	user: { name: "Тарас Демо", email: "student@example.invalid" },
	icsToken: "test-feed-token",
	programme: { name: "Комп'ютерні науки", grade: 4 },
	inp: INP_FIXTURE,
	plan: {
		picked: ["БПП", "ІМ", "ІБЦС", "ТнВ"],
		selection: { БПП: "3", ІМ: "1", ІБЦС: "1", ТнВ: "3" },
		registered: { БПП: "3", ІМ: "4" },
		hidden: [],
		// Five minutes before the clock PlannerPage.mockBackend pins.
		sazSyncedAt: "2026-08-20T06:55:00.000Z",
	},
};

/** Returning student whose teachers moved things: one lecture moved, one
 *  online on odd weeks, and the thesis meetings no sheet prints. */
export const ME_CORRECTED: MeFixture = {
	...ME_RETURNING,
	plan: {
		...ME_RETURNING.plan,
		overrides: {
			"ІБЦС|лекція|Середа|11:40-13:00": { day: "Четвер", slot: "10:00-11:20" },
			"БПП|лекція|Середа|10:00-11:20": {
				day: "Середа",
				slot: "10:00-11:20",
				room: "онлайн",
				weeks: [3, 5, 7, 9, 11],
			},
		},
		custom: [
			{
				id: "own-thesis",
				name: "Кваліфікаційна робота",
				day: "Понеділок",
				slot: "13:30-14:50",
				weeks: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
				room: "Zoom",
				teacher: "доц. Петренко О.В.",
				courseId: "365177",
			},
		],
	},
};

/** Returning student whose Google Calendar already polls the feed. */
export const ME_SUBSCRIBED: MeFixture = {
	...ME_RETURNING,
	// Three hours before the clock PlannerPage.mockBackend pins.
	feedFetchedAt: "2026-08-20T04:00:00.000Z",
	feedClient: "Google",
};
