import { useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import type { UkmaDataReviewCase } from "@/lib/api/generated";
import {
	ukmaDataSiteOfferings,
	useUkmaDataReviewCaseRetrieve,
} from "@/lib/api/generated";
import { cn } from "@/lib/utils";
import { caseRowHint, offeringFacts, peopleTable } from "../casePeople";
import type { PersonColumn } from "../casePeople";
import { candidateIds, NO_RETRY } from "../reviewCases";
import { formatCount } from "../syncFormat";
import { CaseSides } from "./CaseDetails";

const SHOWN_OFFERINGS = 10;

function RetryLine({
	text,
	retrying,
	onRetry,
}: Readonly<{ text: string; retrying: boolean; onRetry: () => void }>) {
	return (
		<div
			role="status"
			className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
		>
			<p>{text}</p>
			<Button variant="outline" size="sm" disabled={retrying} onClick={onRetry}>
				Спробувати ще
			</Button>
		</div>
	);
}

function PersonCard({
	column,
	rows,
}: Readonly<{ column: PersonColumn; rows: readonly string[] }>) {
	const same = !column.record && column.differs.every((differs) => !differs);
	return (
		<article
			className={cn(
				"flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 sm:p-5",
				column.record && "border-2 border-primary",
			)}
		>
			<div className="flex flex-wrap items-center gap-2">
				<p
					className={cn(
						"text-xs",
						column.record ? "text-primary" : "text-muted-foreground",
					)}
				>
					{column.label}
				</p>
				{same ? <Badge variant="outline">Усе збігається</Badge> : null}
			</div>
			<dl className="grid grid-cols-[7rem_1fr] gap-y-1.5 text-sm">
				{rows.map((term, index) => (
					<div key={term} className="contents">
						<dt className="text-muted-foreground">{term}</dt>
						<dd
							className={cn(
								"min-w-0 break-words",
								column.differs[index] &&
									"rounded-sm bg-tint-caution px-1 font-medium text-tint-caution-foreground",
							)}
						>
							{column.values[index]}
						</dd>
					</div>
				))}
			</dl>
		</article>
	);
}

function StudentPeople({
	reviewCase,
}: Readonly<{ reviewCase: UkmaDataReviewCase }>) {
	const found = useUkmaDataReviewCaseRetrieve(reviewCase.id, NO_RETRY);
	if (found.isLoading) {
		return <Skeleton className="h-48 rounded-xl" />;
	}
	if (found.error || found.data === undefined) {
		return (
			<div className="space-y-3">
				<RetryLine
					text="Імена зараз не завантажились, тому нижче лише загальний опис."
					retrying={found.isFetching}
					onRetry={() => void found.refetch()}
				/>
				<CaseSides reviewCase={reviewCase} />
			</div>
		);
	}
	const table = peopleTable(found.data);
	return (
		<div className="space-y-2">
			<div
				className="grid gap-4 md:grid-cols-2 xl:grid-flow-col xl:auto-cols-fr xl:grid-cols-none"
				aria-label="Запис і схожі студенти"
			>
				{table.columns.map((column) => (
					<PersonCard key={column.key} column={column} rows={table.rows} />
				))}
			</div>
			<p className="text-sm text-muted-foreground">
				Виділено те, що відрізняється від нового запису.
			</p>
		</div>
	);
}

function HeldOfferings({
	reviewCase,
}: Readonly<{ reviewCase: UkmaDataReviewCase }>) {
	const ids = candidateIds(reviewCase);
	const [all, setAll] = useState(false);
	const offerings = useQuery({
		queryKey: ["ukma-data-site-offerings", reviewCase.id],
		queryFn: ({ signal }) => ukmaDataSiteOfferings({ ukma_ids: ids }, signal),
		enabled: ids.length > 0,
		retry: false,
	});
	if (offerings.isLoading) {
		return <Skeleton className="h-48 rounded-xl" />;
	}
	if (offerings.error || offerings.data === undefined) {
		return (
			<div className="space-y-3">
				{offerings.error ? (
					<RetryLine
						text="Семестри зараз не завантажились, тому нижче лише загальний опис."
						retrying={offerings.isFetching}
						onRetry={() => void offerings.refetch()}
					/>
				) : null}
				<CaseSides reviewCase={reviewCase} />
			</div>
		);
	}
	const { items, missing } = offerings.data;
	const shown = all ? items : items.slice(0, SHOWN_OFFERINGS);
	return (
		<div className="space-y-2">
			<ul
				aria-label="Семестри, яких немає в САЗ"
				className="divide-y rounded-xl border bg-card"
			>
				{shown.map((offering) => (
					<li
						key={offering.ukma_data_id}
						className="px-4 py-2.5 text-sm sm:px-5"
					>
						<Link
							to="/courses/$courseId"
							params={{ courseId: offering.course_id }}
							className="line-clamp-2 font-medium hover:underline"
							title={offering.title}
						>
							{offering.title}
						</Link>
						<p className="text-muted-foreground">{offeringFacts(offering)}</p>
					</li>
				))}
			</ul>
			<div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
				<span>
					{missing > 0
						? `Ще ${formatCount(missing)} вже немає на сайті.`
						: "Спершу ті, що мають оцінки."}
				</span>
				{items.length > SHOWN_OFFERINGS && !all ? (
					<Button variant="outline" size="sm" onClick={() => setAll(true)}>
						Показати всі {formatCount(items.length)}
					</Button>
				) : null}
			</div>
		</div>
	);
}

export function CaseSubjects({
	reviewCase,
}: Readonly<{ reviewCase: UkmaDataReviewCase }>) {
	switch (reviewCase.kind) {
		case "student_match":
			return <StudentPeople reviewCase={reviewCase} />;
		case "removals_held":
			return <HeldOfferings reviewCase={reviewCase} />;
		default:
			return <CaseSides reviewCase={reviewCase} />;
	}
}

export function CaseRowHint({
	reviewCase,
}: Readonly<{ reviewCase: UkmaDataReviewCase }>) {
	const found = useUkmaDataReviewCaseRetrieve(reviewCase.id, {
		query: {
			retry: false,
			staleTime: 300_000,
			enabled: reviewCase.kind === "student_match",
		},
	});
	if (found.data === undefined) {
		return null;
	}
	return <p className="font-medium">{caseRowHint(found.data)}</p>;
}
