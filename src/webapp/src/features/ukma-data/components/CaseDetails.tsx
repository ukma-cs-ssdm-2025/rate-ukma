import type { UkmaDataReviewCase } from "@/lib/api/generated";
import { cn } from "@/lib/utils";
import {
	caseMeanwhile,
	caseOptions,
	caseSides,
	DIFFERENT_PEOPLE,
} from "../caseScreen";
import type { CaseSide } from "../caseScreen";
import { candidateIds, formatDateTime } from "../reviewCases";
import { CaseActions } from "./CaseActions";
import { CaseRecords } from "./CaseRecords";
import { StudentCaseCompare } from "./StudentCaseCompare";

function SideCard({
	side,
	primary,
}: Readonly<{ side: CaseSide; primary: boolean }>) {
	return (
		<article
			className={cn(
				"flex flex-col gap-3 rounded-xl border bg-card p-5",
				primary && "border-2 border-primary",
			)}
		>
			<h3 className="space-y-0.5">
				<span
					className={cn(
						"block text-sm",
						primary ? "text-primary" : "text-muted-foreground",
					)}
				>
					{side.label}
				</span>
				<span className="block text-lg font-medium">{side.title}</span>
			</h3>
			<dl className="grid grid-cols-[8rem_1fr] gap-y-1.5 text-sm">
				{side.rows.map(([term, value]) => (
					<div key={term} className="contents">
						<dt className="text-muted-foreground">{term}</dt>
						<dd className="min-w-0 break-words">{value}</dd>
					</div>
				))}
			</dl>
		</article>
	);
}

export function CaseSides({
	reviewCase,
}: Readonly<{ reviewCase: UkmaDataReviewCase }>) {
	if (reviewCase.kind === "student_match") {
		return <StudentCaseCompare caseId={reviewCase.id} />;
	}
	if (
		reviewCase.kind === "course_match" ||
		reviewCase.kind === "removals_held"
	) {
		return <CaseRecords reviewCase={reviewCase} />;
	}
	const [record, matched] = caseSides(reviewCase);
	return (
		<div className="grid gap-4 md:grid-cols-2">
			<SideCard side={record} primary />
			<SideCard side={matched} primary={false} />
		</div>
	);
}

export function CaseOutcome({
	reviewCase,
	decideEnabled,
}: Readonly<{ reviewCase: UkmaDataReviewCase; decideEnabled: boolean }>) {
	return (
		<div className="space-y-3 rounded-xl border bg-card p-4 text-sm">
			<div className="space-y-1">
				<p className="font-medium">
					Що означає кожне рішення в сервісі даних САЗ:
				</p>
				<ul className="space-y-1">
					{caseOptions(reviewCase.kind).map((option) => (
						<li key={option.name}>
							<span className="font-medium">{option.name}</span> —{" "}
							{option.effect}
						</li>
					))}
				</ul>
				{reviewCase.kind === "student_match" ? <p>{DIFFERENT_PEOPLE}</p> : null}
				<p>{caseMeanwhile(reviewCase)}</p>
			</div>
			<CaseActions reviewCase={reviewCase} decideEnabled={decideEnabled} />
		</div>
	);
}

export function CaseTechDetails({
	reviewCase,
}: Readonly<{ reviewCase: UkmaDataReviewCase }>) {
	const rows = [
		["Справа", reviewCase.id],
		["Обʼєкт", reviewCase.subject_id],
		["Кандидати", candidateIds(reviewCase).join(", ") || "—"],
		["Запуск", reviewCase.run_id ?? "—"],
		["Рішення", reviewCase.decision_id ?? "—"],
		["Відкрито", formatDateTime(reviewCase.opened_at)],
	] as const;
	return (
		<details className="text-sm text-muted-foreground">
			<summary className="cursor-pointer">Технічні деталі</summary>
			<dl className="mt-2 grid grid-cols-[6rem_1fr] gap-x-4 gap-y-1">
				{rows.map(([term, value]) => (
					<div key={term} className="contents">
						<dt>{term}</dt>
						<dd className="min-w-0 font-mono text-xs break-all">{value}</dd>
					</div>
				))}
			</dl>
		</details>
	);
}
