import { Link } from "@tanstack/react-router";
import { Inbox } from "lucide-react";

import { buttonVariants } from "@/components/ui/Button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/Empty";
import { Skeleton } from "@/components/ui/Skeleton";
import { useUkmaDataSyncPendingList } from "@/lib/api/generated";
import { GROUP_ROW_LABEL, GROUP_ROW_TEXT } from "../syncActions";
import { formatCount } from "../syncFormat";
import { GROUP_ORDER, NO_RETRY } from "../syncOverview";
import { Term } from "./Term";
import { UkmaDataError } from "./UkmaDataError";

function NothingWaits() {
	return (
		<Empty className="border">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<Inbox />
				</EmptyMedia>
				<EmptyTitle>Нічого не чекає рішення</EmptyTitle>
				<EmptyDescription>Наступне читання САЗ о 02:30.</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}

export function SyncPendingTab() {
	const pending = useUkmaDataSyncPendingList(
		{ source: "catalog", page: 1, page_size: 1 },
		NO_RETRY,
	);
	const counts = pending.data?.groups ?? {};
	const total = GROUP_ORDER.reduce(
		(sum, group) => sum + (counts[group] ?? 0),
		0,
	);
	return (
		<div className="space-y-4">
			<p className="text-sm text-muted-foreground">
				Зміни з останнього читання САЗ, які ще{" "}
				<Term name="waiting">чекають рішення</Term>. Відкрийте групу, щоб
				переглянути зміни.
			</p>
			{pending.isLoading ? <Skeleton className="h-64 rounded-xl" /> : null}
			{pending.error ? (
				<UkmaDataError
					error={pending.error}
					title="Не вдалося завантажити зміни"
					onRetry={() => void pending.refetch()}
					isRetrying={pending.isRefetching}
				/>
			) : null}
			{pending.data && !pending.error && total === 0 ? <NothingWaits /> : null}
			{pending.data && !pending.error && total > 0 ? (
				<ul
					aria-label="Що чекає рішення"
					className="divide-y overflow-hidden rounded-xl border bg-card"
				>
					{GROUP_ORDER.map((group) => (
						<li
							key={group}
							className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:flex-nowrap sm:px-5"
						>
							<span className="w-24 shrink-0 font-medium sm:w-28">
								<Term name={group}>{GROUP_ROW_LABEL[group]}</Term>
							</span>
							<span className="shrink-0 text-right text-lg font-semibold tabular-nums sm:w-20">
								{formatCount(counts[group] ?? 0)}
							</span>
							<span className="order-last w-full min-w-0 text-sm text-muted-foreground sm:order-none sm:flex-1">
								{GROUP_ROW_TEXT[group]}
							</span>
							<Link
								to="/data/sync/preview"
								search={{ group }}
								className={buttonVariants({ variant: "outline", size: "sm" })}
							>
								Переглянути
							</Link>
						</li>
					))}
				</ul>
			) : null}
		</div>
	);
}
