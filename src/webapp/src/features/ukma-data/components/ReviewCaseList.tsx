import { Link } from "@tanstack/react-router";
import {
	parseAsInteger,
	parseAsString,
	parseAsStringEnum,
	useQueryStates,
} from "nuqs";

import type { UkmaDataReviewCase } from "@/lib/api/generated";
import type { CaseCounts } from "../hooks/useCaseCounts";
import {
	caseDetail,
	caseKinds,
	caseStatuses,
	caseTitle,
	formatDateTime,
	KIND_SEGMENTS,
	receivedText,
	sinceText,
	STATUS_LABELS,
	STATUS_SEGMENTS,
	STATUS_TONES,
} from "../reviewCases";
import { DataChip, DataSegments } from "./DataBits";
import { DataSearch, DataTableFrame, DataTd, DataTh } from "./DataTable";

const ALL = "all";

const kindParser = parseAsStringEnum([...caseKinds, ALL]);
const statusParser = parseAsStringEnum([...caseStatuses, ALL]);

export function useCaseFilterParams() {
	return useQueryStates({
		kind: kindParser.withDefault(ALL),
		status: statusParser.withDefault("open"),
		q: parseAsString.withDefault(""),
		page: parseAsInteger.withDefault(1),
	});
}

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

export function ReviewCaseFilters({
	counts,
}: Readonly<{ counts: CaseCounts }>) {
	const [{ kind, status, q }, setParams] = useCaseFilterParams();
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
							count: counts.status[item],
						})),
						{ value: ALL, label: "Усі", count: counts.status.all },
					]}
				/>
			</FilterRow>
			<FilterRow label="Тип">
				<DataSegments
					label="Тип"
					value={kind}
					onChange={(value) => void setParams({ kind: value, page: 1 })}
					items={[
						{ value: ALL, label: "Усі", count: counts.kind.all },
						...caseKinds.map((item) => ({
							value: item,
							label: KIND_SEGMENTS[item],
							count: counts.kind[item],
						})),
					]}
				/>
			</FilterRow>
			<DataSearch
				value={q}
				placeholder="Пошук у справах"
				onChange={(value) => void setParams({ q: value, page: 1 })}
				className="max-w-md"
			/>
		</div>
	);
}

export function useCaseSearch() {
	const [{ kind, status, q, page }] = useCaseFilterParams();
	return { kind, status, q, page };
}

function CaseRow({ reviewCase }: Readonly<{ reviewCase: UkmaDataReviewCase }>) {
	const search = useCaseSearch();
	return (
		<tr className="border-t transition-colors hover:bg-muted/50">
			<DataTd>
				<Link
					to="/data/cases/$caseId"
					params={{ caseId: reviewCase.id }}
					search={search}
					className="font-medium hover:underline"
				>
					{caseTitle(reviewCase)}
				</Link>
				<p className="text-muted-foreground">
					{caseDetail(reviewCase)} · {receivedText(reviewCase.opened_at)}
				</p>
				<p className="text-muted-foreground sm:hidden">
					{sinceText(reviewCase.opened_at)}
				</p>
			</DataTd>
			<DataTd className="hidden text-muted-foreground sm:table-cell">
				<span title={formatDateTime(reviewCase.opened_at)}>
					{sinceText(reviewCase.opened_at)}
				</span>
			</DataTd>
			<DataTd>
				<DataChip tone={STATUS_TONES[reviewCase.status]}>
					{STATUS_LABELS[reviewCase.status]}
				</DataChip>
			</DataTd>
		</tr>
	);
}

export function ReviewCaseTable({
	cases,
}: Readonly<{ cases: readonly UkmaDataReviewCase[] }>) {
	return (
		<DataTableFrame>
			<caption className="sr-only">Справи</caption>
			<thead>
				<tr>
					<DataTh>Справа</DataTh>
					<DataTh className="hidden w-40 sm:table-cell">З якого часу</DataTh>
					<DataTh className="w-36 sm:w-44">Стан</DataTh>
				</tr>
			</thead>
			<tbody>
				{cases.map((reviewCase) => (
					<CaseRow key={reviewCase.id} reviewCase={reviewCase} />
				))}
			</tbody>
		</DataTableFrame>
	);
}
