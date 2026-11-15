import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import {
	type UkmaDataStatus,
	useUkmaDataReviewCasesList,
} from "@/lib/api/generated";
import {
	CASE_KIND_LABELS,
	caseKinds,
	formatDateTime,
	NO_RETRY,
	PAGE,
} from "../reviewCases";

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

function OpenCasesCard() {
	const { data, isError, isLoading } = useUkmaDataReviewCasesList(
		PAGE,
		NO_RETRY,
	);
	const open = data?.items?.filter((item) => item.status === "open") ?? [];
	// The API sends no totals, so a count is true only when the first page is everything.
	const complete = data !== undefined && !data.has_more;
	const oldest = open.reduce<string | undefined>(
		(min, item) =>
			item.opened_at && (!min || item.opened_at < min) ? item.opened_at : min,
		undefined,
	);
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">
					Відкриті справи{complete ? `: ${open.length}` : ""}
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-1 text-sm">
				{isLoading ? <Skeleton className="h-20" /> : null}
				{isError ? (
					<p className="text-muted-foreground">Справи не завантажено.</p>
				) : null}
				{data
					? caseKinds.map((kind) => (
							<Link
								key={kind}
								to="/data/cases"
								search={{ kind, status: "open" }}
								className="flex justify-between gap-4 rounded-md py-1 hover:text-primary"
							>
								<span>{CASE_KIND_LABELS[kind]}</span>
								{complete ? (
									<span className="font-medium tabular-nums">
										{open.filter((item) => item.kind === kind).length}
									</span>
								) : null}
							</Link>
						))
					: null}
				{data ? (
					<p className="pt-2 text-muted-foreground">
						{!complete
							? "Показано лише першу сторінку справ."
							: oldest
								? `Найстаріша відкрита з ${formatDateTime(oldest)}`
								: "Відкритих справ немає"}
					</p>
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
