import {
	AppleIcon,
	GoogleCalendarIcon,
	MicrosoftIcon,
} from "@/features/schedule/components/BrandIcons";
import type { Feed } from "@/features/schedule/hooks/usePlanner";
import { telemetry } from "@/features/schedule/lib/telemetry";

/**
 * The calendars a student can subscribe to the feed in, in the order every
 * offer shows them. The rail's calendar card and the toolbar's «У календар»
 * menu both render from this, so they always offer the same three.
 */
export const CALENDAR_CLIENTS = {
	Google: {
		title: "Google Календар",
		label: "Google",
		hint: undefined,
		target: "google",
		Icon: GoogleCalendarIcon,
		href: (feed: Feed) => feed.google,
		newTab: true,
	},
	Outlook: {
		title: "Outlook",
		label: "Outlook",
		hint: undefined,
		target: "outlook",
		Icon: MicrosoftIcon,
		href: (feed: Feed) => feed.outlook,
		newTab: true,
	},
	// `webcal://` hands the feed to the system Calendar app; a new tab would stay blank.
	Apple: {
		title: "Календар Apple",
		label: "Apple",
		hint: "iPhone, iPad і Mac",
		target: "apple",
		Icon: AppleIcon,
		href: (feed: Feed) => feed.apple,
		newTab: false,
	},
} as const;
export type CalendarClient = keyof typeof CALENDAR_CLIENTS;

export const CALENDAR_ORDER: readonly CalendarClient[] = [
	"Google",
	"Outlook",
	"Apple",
];

export const isCalendarClient = (
	value: string | null,
): value is CalendarClient =>
	value === "Google" || value === "Apple" || value === "Outlook";

/** The link that subscribes `client` to the feed: Google and Outlook in a new tab, Apple in place. */
export const calendarAnchor = (feed: Feed, client: CalendarClient) => {
	const { href, newTab } = CALENDAR_CLIENTS[client];
	return newTab
		? { href: href(feed), target: "_blank", rel: "noopener noreferrer" }
		: { href: href(feed) };
};

/** Counts a subscribe click, or a copy of the bare feed link. */
export const trackCalendarOpened = (client: CalendarClient | "link") =>
	telemetry.track("calendar_opened", {
		target: client === "link" ? "link" : CALENDAR_CLIENTS[client].target,
	});
