import { CalendarCheck, ChevronDown, Clock, Link2 } from "lucide-react";
import { useState } from "react";
import {
	CALENDAR_CLIENTS,
	CALENDAR_ORDER,
	calendarAnchor,
	isCalendarClient,
	trackCalendarOpened,
	type CalendarClient,
} from "@/features/schedule/components/CalendarClients";
import { Button } from "@/components/ui/Button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/Collapsible";
import type { Feed } from "@/features/schedule/hooks/usePlanner";
import {
	copyTextSilent,
	toastCopyFailed,
} from "@/features/schedule/lib/clipboard";
import { absoluteTime, shortAgo } from "@/features/schedule/lib/format";

/** The feed and whether a calendar has polled it yet (`/api/schedule/me`). */
export interface CalendarLink {
	readonly feed: Feed;
	readonly fetchedAt: string | null;
	readonly client: string | null;
}

// Which calendar the student went to add the feed in, until it first polls.
// Only this browser knows; storage may be off, and then the offer stays.
const PENDING_KEY = "ukma-calendar-pending";

const readPending = (): CalendarClient | undefined => {
	try {
		const stored = window.localStorage.getItem(PENDING_KEY);
		return isCalendarClient(stored) ? stored : undefined;
	} catch {
		return undefined;
	}
};

const writePending = (client: CalendarClient | undefined): void => {
	try {
		if (client === undefined) window.localStorage.removeItem(PENDING_KEY);
		else window.localStorage.setItem(PENDING_KEY, client);
	} catch {
		// Without storage the card simply keeps offering the buttons.
	}
};

/**
 * The plan card's last step, once every group is chosen: subscribe a
 * calendar to the feed. Three states: the offer, waiting for the first poll
 * (Google takes hours), and connected once the server saw a poll. Connected
 * still folds the same buttons away, for a second device or a calendar that
 * lost the feed.
 */
export function CalendarCard({ calendar }: { calendar: CalendarLink }) {
	const { feed, fetchedAt, client } = calendar;
	const [pending, setPending] = useState(readPending);
	const [again, setAgain] = useState(false);

	if (fetchedAt !== null) {
		return (
			<Collapsible
				open={again}
				onOpenChange={setAgain}
				data-testid="calendar-connected"
			>
				<p className="flex items-center gap-1.5 text-xs font-semibold text-success">
					<CalendarCheck className="size-4 shrink-0" /> Календар підключено
				</p>
				<p
					className="mt-0.5 text-meta text-muted-foreground"
					title={absoluteTime(fetchedAt)}
				>
					{isCalendarClient(client)
						? CALENDAR_CLIENTS[client].title
						: "Календар"}
					, оновлював {shortAgo(fetchedAt)}
				</p>
				<CollapsibleTrigger asChild>
					<Button
						variant="link"
						size="xs"
						data-testid="calendar-again"
						className="mt-1 h-auto p-0 text-meta"
					>
						Додати ще раз або в інший календар
						<ChevronDown className="size-3 transition-transform duration-200 ease-out-quint group-aria-expanded/button:rotate-180" />
					</Button>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<Subscribe feed={feed} onChose={() => undefined} className="pt-1.5" />
				</CollapsibleContent>
			</Collapsible>
		);
	}

	if (pending !== undefined) {
		return (
			<div data-testid="calendar-waiting">
				<p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
					<Clock className="size-4 shrink-0 text-muted-foreground" /> Чекаємо на{" "}
					{CALENDAR_CLIENTS[pending].title}
				</p>
				<p className="mt-0.5 text-meta leading-relaxed text-muted-foreground">
					{pending === "Google"
						? "Google забирає розклад раз на кілька годин; тут з’явиться «підключено», щойно він це зробить."
						: "Тут з’явиться «підключено», щойно календар уперше забере розклад."}
				</p>
				<Button
					variant="link"
					size="xs"
					data-testid="calendar-retry"
					onClick={() => {
						writePending(undefined);
						setPending(undefined);
					}}
					className="mt-1 h-auto p-0 text-meta"
				>
					Не з’явився за день? Підключити ще раз
				</Button>
			</div>
		);
	}

	return (
		<div data-testid="calendar-offer">
			<p className="text-xs font-semibold text-foreground">
				Додай у свій календар
			</p>
			<p className="mt-0.5 text-meta leading-relaxed text-muted-foreground">
				Пари з’являться в телефоні, а зміни в розкладі підтягнуться самі.
			</p>
			<Subscribe
				feed={feed}
				onChose={(picked) => {
					writePending(picked);
					setPending(picked);
				}}
				className="mt-2"
			/>
		</div>
	);
}

/** The three calendars as buttons, and the bare feed link for any other. */
function Subscribe(props: {
	feed: Feed;
	onChose: (client: CalendarClient) => void;
	className?: string;
}) {
	const { feed, onChose, className = "" } = props;
	const [copied, setCopied] = useState(false);
	const chose = (picked: CalendarClient) => {
		trackCalendarOpened(picked);
		onChose(picked);
	};
	const copy = async () => {
		trackCalendarOpened("link");
		if (!(await copyTextSilent(feed.url))) {
			toastCopyFailed();
			return;
		}
		setCopied(true);
		window.setTimeout(() => setCopied(false), 1600);
	};

	return (
		<div className={className}>
			<div className="grid grid-cols-3 gap-1.5">
				{CALENDAR_ORDER.map((client) => {
					const { label, hint, Icon } = CALENDAR_CLIENTS[client];
					return (
						<Button
							key={client}
							variant="outline"
							size="compact"
							asChild
							className="min-w-0"
							title={hint}
						>
							<a
								{...calendarAnchor(feed, client)}
								data-testid={`calendar-${CALENDAR_CLIENTS[client].target}`}
								onClick={() => chose(client)}
							>
								<Icon /> {label}
							</a>
						</Button>
					);
				})}
			</div>
			<Button
				variant="link"
				size="xs"
				data-testid="calendar-copy"
				onClick={() => void copy()}
				className="mt-1.5 h-auto p-0 text-meta"
			>
				<Link2 className="size-3" />
				{copied ? "Скопійовано" : "Інший календар: скопіювати посилання"}
			</Button>
		</div>
	);
}
