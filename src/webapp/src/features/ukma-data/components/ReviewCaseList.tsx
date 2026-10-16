import { Link } from "@tanstack/react-router";
import { Inbox } from "lucide-react";
import { parseAsStringEnum, useQueryStates } from "nuqs";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/Empty";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/Select";
import { caseKinds, caseStatuses, type ReviewCase } from "../api/schemas";
import {
	CASE_KIND_LABELS,
	CASE_STATUS_LABELS,
	caseTitle,
	formatAcademicYear,
	formatDateTime,
} from "../reviewCases";

const ALL = "all";
const percent = new Intl.NumberFormat("uk-UA", { style: "percent" });

export function useCaseFilterParams() {
	return useQueryStates({
		kind: parseAsStringEnum([...caseKinds, ALL]).withDefault(ALL),
		status: parseAsStringEnum([...caseStatuses, ALL]).withDefault("open"),
	});
}

export function ReviewCaseFilters() {
	const [{ kind, status }, setParams] = useCaseFilterParams();
	return (
		<div className="flex flex-col gap-2 sm:flex-row">
			<Select
				value={kind}
				onValueChange={(value) => setParams({ kind: value as typeof kind })}
			>
				<SelectTrigger aria-label="Тип справи" className="w-full sm:w-56">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value={ALL}>Усі типи</SelectItem>
					{caseKinds.map((item) => (
						<SelectItem key={item} value={item}>
							{CASE_KIND_LABELS[item]}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Select
				value={status}
				onValueChange={(value) => setParams({ status: value as typeof status })}
			>
				<SelectTrigger aria-label="Стан справи" className="w-full sm:w-44">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value={ALL}>Усі стани</SelectItem>
					{caseStatuses.map((item) => (
						<SelectItem key={item} value={item}>
							{CASE_STATUS_LABELS[item]}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}

function caseMeta(reviewCase: ReviewCase): string {
	if (reviewCase.kind === "removals_held") {
		return `${reviewCase.liveOfferings} пропозицій у році, поріг ${percent.format(reviewCase.threshold)}`;
	}
	const { sazCode, academicYear } = reviewCase.subject;
	return `САЗ ${sazCode}, ${formatAcademicYear(academicYear)}`;
}

export function ReviewCaseList({
	cases,
}: Readonly<{ cases: ReadonlyArray<ReviewCase> }>) {
	if (cases.length === 0) {
		return (
			<Empty className="border">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<Inbox />
					</EmptyMedia>
					<EmptyTitle>Справ немає</EmptyTitle>
					<EmptyDescription>
						Сервіс вирішив усе сам, або фільтр нічого не знайшов.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}
	return (
		<ul className="space-y-3" aria-label="Справи на розгляд">
			{cases.map((reviewCase) => (
				<li key={reviewCase.id}>
					<Card asChild>
						<Link
							to="/data/cases/$caseId"
							params={{ caseId: reviewCase.id }}
							className="block space-y-2 p-4 transition-colors hover:bg-accent/50"
						>
							<div className="flex flex-wrap items-center gap-2">
								<Badge variant="soft">
									{CASE_KIND_LABELS[reviewCase.kind]}
								</Badge>
								<Badge
									variant={
										reviewCase.status === "open" ? "outline" : "secondary"
									}
								>
									{CASE_STATUS_LABELS[reviewCase.status]}
								</Badge>
							</div>
							<p className="font-medium break-words">{caseTitle(reviewCase)}</p>
							<p className="text-sm text-muted-foreground">
								{caseMeta(reviewCase)} · відкрито{" "}
								{formatDateTime(reviewCase.openedAt)}
							</p>
						</Link>
					</Card>
				</li>
			))}
		</ul>
	);
}
