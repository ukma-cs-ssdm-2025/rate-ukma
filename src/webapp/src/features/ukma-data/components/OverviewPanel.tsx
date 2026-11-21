import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useUkmaDataReviewCasesList } from "@/lib/api/generated";
import type {
	UkmaDataReviewCaseKindEnum,
	UkmaDataStatus,
} from "@/lib/api/generated";
import { cn } from "@/lib/utils";
import {
	CASE_KIND_LABELS,
	caseKinds,
	formatDateTime,
	NO_RETRY,
	PAGE,
} from "../reviewCases";
import { UkmaDataError } from "./UkmaDataError";

function KeyCard({ status }: Readonly<{ status: UkmaDataStatus }>) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Дані САЗ</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2 text-sm">
				<p className="text-muted-foreground">
					UKMA Data востаннє оновив дані з САЗ
				</p>
				<p className="text-2xl font-semibold">
					{status.data_updated_at
						? formatDateTime(status.data_updated_at)
						: "Ще не оновлено"}
				</p>
				<p className="pt-2 text-muted-foreground">
					Ключ {status.key_id}, діє до{" "}
					{status.key_expires_at ? formatDateTime(status.key_expires_at) : "—"}
				</p>
				<div className="flex flex-wrap items-center gap-1">
					<span className="text-muted-foreground">Права ключа:</span>
					{status.scopes?.map((scope) => (
						<Badge key={scope} variant="outline">
							{scope}
						</Badge>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

const KIND_COLORS: Record<
	UkmaDataReviewCaseKindEnum,
	{ dot: string; pill: string }
> = {
	course_match: { dot: "bg-chart-1", pill: "bg-chart-1/15" },
	instructor_match: { dot: "bg-chart-2", pill: "bg-chart-2/15" },
	student_match: { dot: "bg-chart-3", pill: "bg-chart-3/15" },
	removals_held: { dot: "bg-destructive", pill: "bg-destructive/15" },
};

function CaseKindRow({
	kind,
	count,
}: Readonly<{ kind: UkmaDataReviewCaseKindEnum; count: number | undefined }>) {
	const active = count !== undefined && count > 0;
	const colors = KIND_COLORS[kind];
	return (
		<Link
			to="/data/cases"
			search={{ kind, status: "open" }}
			className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted"
		>
			<span
				className={cn("size-2 rounded-full", active ? colors.dot : "bg-border")}
			/>
			<span className={active ? undefined : "text-muted-foreground"}>
				{CASE_KIND_LABELS[kind]}
			</span>
			{count === undefined ? null : (
				<span
					className={cn(
						"ml-auto min-w-7 rounded-full px-2 text-center font-semibold tabular-nums",
						active ? colors.pill : "text-muted-foreground",
					)}
				>
					{count}
				</span>
			)}
		</Link>
	);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const UK_PLURAL = new Intl.PluralRules("uk");
const DAY_FORMS: Record<Intl.LDMLPluralRule, string> = {
	zero: "днів",
	one: "день",
	two: "дні",
	few: "дні",
	many: "днів",
	other: "дня",
};

function OldestCase({ openedAt }: Readonly<{ openedAt: string }>) {
	const days = Math.max(
		0,
		Math.floor((Date.now() - Date.parse(openedAt)) / MS_PER_DAY),
	);
	const waited =
		days === 0 ? "менше доби" : `${days} ${DAY_FORMS[UK_PLURAL.select(days)]}`;
	return (
		<div className="flex flex-wrap items-center gap-2 text-xs">
			<span className="rounded-full bg-chart-5/20 px-3 py-1">
				Найстаріша чекає {waited}
			</span>
			<span className="text-muted-foreground">
				з {formatDateTime(openedAt)}
			</span>
		</div>
	);
}

function OpenCasesCard() {
	const { data, error, isLoading, refetch, isRefetching } =
		useUkmaDataReviewCasesList(PAGE, NO_RETRY);
	const open = data?.items?.filter((item) => item.status === "open") ?? [];
	const complete = data !== undefined && !error && !data.has_more;
	const oldest = open.reduce<string | undefined>(
		(min, item) =>
			item.opened_at && (!min || item.opened_at < min) ? item.opened_at : min,
		undefined,
	);
	return (
		<Card>
			<CardHeader className="flex flex-row items-baseline justify-between">
				<CardTitle className="text-base">
					Відкриті справи
					{complete ? <span className="sr-only">: {open.length}</span> : null}
				</CardTitle>
				{complete ? (
					<span
						aria-hidden
						className="text-4xl font-bold leading-none text-primary tabular-nums"
					>
						{open.length}
					</span>
				) : null}
			</CardHeader>
			<CardContent className="space-y-1 text-sm">
				{isLoading ? <Skeleton className="h-20" /> : null}
				{error ? (
					<UkmaDataError
						error={error}
						title="Не вдалося завантажити справи"
						onRetry={refetch}
						isRetrying={isRefetching}
					/>
				) : null}
				{data && !error
					? caseKinds.map((kind) => (
							<CaseKindRow
								key={kind}
								kind={kind}
								count={
									complete
										? open.filter((item) => item.kind === kind).length
										: undefined
								}
							/>
						))
					: null}
				{data && !error ? (
					<div className="pt-3">
						{!complete ? (
							<p className="text-muted-foreground">
								Показано лише першу сторінку справ.
							</p>
						) : oldest ? (
							<OldestCase openedAt={oldest} />
						) : (
							<p className="text-muted-foreground">Відкритих справ немає</p>
						)}
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}

export function OverviewPanel({
	status,
}: Readonly<{ status: UkmaDataStatus }>) {
	return (
		<div className="grid gap-4 md:grid-cols-2">
			<KeyCard status={status} />
			<OpenCasesCard />
		</div>
	);
}

export function OverviewPanelSkeleton() {
	return (
		<div className="grid gap-4 md:grid-cols-3">
			{[0, 1].map((index) => (
				<Skeleton key={index} className="h-56 rounded-xl" />
			))}
		</div>
	);
}
