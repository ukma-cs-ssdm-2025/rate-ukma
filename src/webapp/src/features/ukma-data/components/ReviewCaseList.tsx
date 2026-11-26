import { Link } from "@tanstack/react-router";
import { parseAsInteger, parseAsStringEnum, useQueryStates } from "nuqs";

import { Badge } from "@/components/ui/Badge";
import type { UkmaDataReviewCase } from "@/lib/api/generated";
import {
	caseDetail,
	caseKinds,
	caseStatuses,
	caseTitle,
	formatDateTime,
	KIND_SEGMENTS,
	receivedText,
	STATUS_LABELS,
	STATUS_SEGMENTS,
	waitedFor,
} from "../reviewCases";
import { DataSegments } from "./DataBits";

const ALL = "all";

const kindParser = parseAsStringEnum([...caseKinds, ALL]);
const statusParser = parseAsStringEnum([...caseStatuses, ALL]);

export function useCaseFilterParams() {
	return useQueryStates({
		kind: kindParser.withDefault(ALL),
		status: statusParser.withDefault("open"),
		page: parseAsInteger.withDefault(1),
	});
}

const STATUS_VARIANTS = {
	open: "soft",
	decided: "success",
	obsolete: "outline",
} as const;

function FilterRow({
	label,
	children,
}: Readonly<{ label: string; children: React.ReactNode }>) {
	return (
		<div className="flex min-w-0 items-center gap-3">
			<span className="w-10 shrink-0 text-sm text-muted-foreground">
				{label}
			</span>
			{children}
		</div>
	);
}

export function ReviewCaseFilters() {
	const [{ kind, status }, setParams] = useCaseFilterParams();
	return (
		<div className="flex flex-col gap-3">
			<FilterRow label="Стан">
				<DataSegments
					label="Стан"
					value={status}
					onChange={(value) => void setParams({ status: value, page: 1 })}
					items={[
						...caseStatuses.map((item) => ({
							value: item,
							label: STATUS_SEGMENTS[item],
						})),
						{ value: ALL, label: "Усі" },
					]}
				/>
			</FilterRow>
			<FilterRow label="Тип">
				<DataSegments
					label="Тип"
					value={kind}
					onChange={(value) => void setParams({ kind: value, page: 1 })}
					items={[
						{ value: ALL, label: "Усі" },
						...caseKinds.map((item) => ({
							value: item,
							label: KIND_SEGMENTS[item],
						})),
					]}
				/>
			</FilterRow>
		</div>
	);
}

export function useCaseSearch() {
	const [{ kind, status, page }] = useCaseFilterParams();
	return { kind, status, page };
}

function CaseRow({ reviewCase }: Readonly<{ reviewCase: UkmaDataReviewCase }>) {
	const search = useCaseSearch();
	return (
		<li className="relative flex flex-col gap-1.5 px-4 py-3 text-sm hover:bg-muted/50 sm:grid sm:grid-cols-[minmax(0,1fr)_8rem_9rem] sm:items-start sm:gap-x-4 sm:px-5">
			<div className="min-w-0">
				<Link
					to="/data/cases/$caseId"
					params={{ caseId: reviewCase.id }}
					search={search}
					className="font-medium break-words after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
				>
					{caseTitle(reviewCase)}
				</Link>
				<p className="text-muted-foreground">{caseDetail(reviewCase)}</p>
			</div>
			<p className="text-muted-foreground">
				<span title={formatDateTime(reviewCase.opened_at)}>
					{receivedText(reviewCase.opened_at)}
				</span>
			</p>
			<div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
				<Badge variant={STATUS_VARIANTS[reviewCase.status]}>
					{STATUS_LABELS[reviewCase.status]}
				</Badge>
				{reviewCase.status === "open" ? (
					<span className="text-muted-foreground">
						чекає {waitedFor(reviewCase.opened_at)}
					</span>
				) : null}
			</div>
		</li>
	);
}

export function ReviewCaseTable({
	cases,
}: Readonly<{ cases: readonly UkmaDataReviewCase[] }>) {
	return (
		<div className="overflow-hidden rounded-xl border bg-card">
			<div
				aria-hidden="true"
				className="hidden border-b px-5 py-2 text-sm text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1fr)_8rem_9rem] sm:gap-x-4"
			>
				<span>Справа</span>
				<span>Відкрито</span>
				<span className="text-right">Стан</span>
			</div>
			<ul aria-label="Справи UKMA Data" className="divide-y">
				{cases.map((reviewCase) => (
					<CaseRow key={reviewCase.id} reviewCase={reviewCase} />
				))}
			</ul>
		</div>
	);
}
