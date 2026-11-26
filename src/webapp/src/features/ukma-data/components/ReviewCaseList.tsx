import { Link } from "@tanstack/react-router";
import { parseAsInteger, parseAsStringEnum, useQueryStates } from "nuqs";

import { Badge } from "@/components/ui/Badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/Table";
import type { UkmaDataReviewCase } from "@/lib/api/generated";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { useUkmaDataReviewCasesList } from "@/lib/api/generated";
import {
	caseDetail,
	caseKinds,
	caseListParams,
	kindCounts,
	NO_RETRY,
	caseStatuses,
	caseTitle,
	formatDateTime,
	KIND_SEGMENTS,
	receivedText,
	sinceText,
	STATUS_LABELS,
	STATUS_SEGMENTS,
	waitedFor,
} from "../reviewCases";
import { DataSegments } from "./DataBits";
import { CaseActions } from "./CaseActions";
import { CaseRowHint } from "./CasePeople";

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
	const all = useUkmaDataReviewCasesList(
		caseListParams({ kind: ALL, status }),
		NO_RETRY,
	);
	const counts = kindCounts(all.data?.items ?? []);
	const kinds = caseKinds.filter(
		(item) => item === kind || (counts.get(item) ?? 0) > 0,
	);
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
						...kinds.map((item) => ({
							value: item,
							label: KIND_SEGMENTS[item],
							count: counts.get(item) ?? 0,
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

function CaseRow({
	reviewCase,
	decideEnabled,
}: Readonly<{ reviewCase: UkmaDataReviewCase; decideEnabled: boolean }>) {
	const search = useCaseSearch();
	return (
		<TableRow>
			<TableCell className="min-w-56">
				<Link
					to="/data/cases/$caseId"
					params={{ caseId: reviewCase.id }}
					search={search}
					className="font-medium hover:underline"
				>
					{caseTitle(reviewCase)}
				</Link>
				<CaseRowHint reviewCase={reviewCase} />
				<p className="text-muted-foreground">
					{caseDetail(reviewCase)} · {receivedText(reviewCase.opened_at)}
				</p>
				<p className="text-muted-foreground sm:hidden">
					{sinceText(reviewCase.opened_at)}
				</p>
			</TableCell>
			<TableCell className="hidden w-32 text-muted-foreground sm:table-cell">
				<span title={formatDateTime(reviewCase.opened_at)}>
					{sinceText(reviewCase.opened_at)}
				</span>
			</TableCell>
			<TableCell className="w-36">
				<Badge variant={STATUS_VARIANTS[reviewCase.status]}>
					{STATUS_LABELS[reviewCase.status]}
				</Badge>
				<p className="mt-1 text-xs text-muted-foreground sm:hidden">
					{waitedFor(reviewCase.opened_at)}
				</p>
			</TableCell>
			<TableCell className="w-64">
				<CaseActions
					reviewCase={reviewCase}
					decideEnabled={decideEnabled}
					explain={false}
				/>
			</TableCell>
		</TableRow>
	);
}

function CaseCard({
	reviewCase,
	decideEnabled,
}: Readonly<{ reviewCase: UkmaDataReviewCase; decideEnabled: boolean }>) {
	const search = useCaseSearch();
	return (
		<li className="space-y-2 px-4 py-3 text-sm">
			<div className="flex items-start justify-between gap-2">
				<Link
					to="/data/cases/$caseId"
					params={{ caseId: reviewCase.id }}
					search={search}
					className="min-w-0 font-medium hover:underline"
				>
					{caseTitle(reviewCase)}
				</Link>
				<Badge
					variant={STATUS_VARIANTS[reviewCase.status]}
					className="shrink-0"
				>
					{STATUS_LABELS[reviewCase.status]}
				</Badge>
			</div>
			<CaseRowHint reviewCase={reviewCase} />
			<p className="text-muted-foreground">
				{caseDetail(reviewCase)} · {sinceText(reviewCase.opened_at)}
			</p>
			<CaseActions
				reviewCase={reviewCase}
				decideEnabled={decideEnabled}
				explain={false}
			/>
		</li>
	);
}

export function ReviewCaseTable({
	cases,
	decideEnabled,
}: Readonly<{ cases: readonly UkmaDataReviewCase[]; decideEnabled: boolean }>) {
	const phone = useMediaQuery("(max-width: 639px)");
	if (phone) {
		return (
			<ul
				aria-label="Справи"
				className="divide-y overflow-hidden rounded-xl border bg-card"
			>
				{cases.map((reviewCase) => (
					<CaseCard
						key={reviewCase.id}
						reviewCase={reviewCase}
						decideEnabled={decideEnabled}
					/>
				))}
			</ul>
		);
	}
	return (
		<div className="overflow-hidden rounded-xl border bg-card">
			<Table>
				<caption className="sr-only">Справи</caption>
				<TableHeader>
					<TableRow>
						<TableHead>Справа</TableHead>
						<TableHead className="hidden w-32 sm:table-cell">
							З якого часу
						</TableHead>
						<TableHead className="w-36">Стан</TableHead>
						<TableHead className="w-64">Рішення</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{cases.map((reviewCase) => (
						<CaseRow
							key={reviewCase.id}
							reviewCase={reviewCase}
							decideEnabled={decideEnabled}
						/>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
