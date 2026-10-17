import { Card, CardContent } from "@/components/ui/Card";
import type { UkmaDataReviewCase } from "@/lib/api/generated";
import { formatDateTime } from "../reviewCases";

/** `candidates` and `safe_answer` are free JSON: ids only, as UKMA Data sent them. */
function JsonValue({ value }: Readonly<{ value: unknown }>) {
	if (value === null || value === undefined) return <>—</>;
	if (typeof value === "string" || typeof value === "number") {
		return <>{value}</>;
	}
	if (
		Array.isArray(value) &&
		value.every((item) => typeof item === "string" || typeof item === "number")
	) {
		return <>{value.length > 0 ? value.join(", ") : "—"}</>;
	}
	return (
		<pre className="overflow-x-auto rounded-md bg-muted p-2 text-xs">
			{JSON.stringify(value, null, 2)}
		</pre>
	);
}

export function CaseDetails({
	reviewCase,
}: Readonly<{ reviewCase: UkmaDataReviewCase }>) {
	const fields = [
		["Обʼєкт", reviewCase.subject_id],
		["Кандидати", reviewCase.candidates],
		["Опубліковано", reviewCase.safe_answer],
		["Запуск", reviewCase.run_id],
		[
			"Відкрито",
			reviewCase.opened_at ? formatDateTime(reviewCase.opened_at) : null,
		],
		["Рішення", reviewCase.decision_id],
	] as const;
	return (
		<Card>
			<CardContent className="pt-6">
				<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
					{fields.map(([label, value]) => (
						<div key={label} className="contents">
							<dt className="text-muted-foreground">{label}</dt>
							<dd className="min-w-0 break-words">
								<JsonValue value={value} />
							</dd>
						</div>
					))}
				</dl>
			</CardContent>
		</Card>
	);
}
