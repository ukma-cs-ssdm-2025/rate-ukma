import { Skeleton } from "@/components/ui/Skeleton";
import type { UkmaDataRecord, UkmaDataReviewCase } from "@/lib/api/generated";
import { useUkmaDataRecordsList } from "@/lib/api/generated";
import { caseRecordIds, recordsSummary } from "../caseRecords";
import { NO_RETRY } from "../reviewCases";
import { countWith, RATINGS } from "../syncFormat";
import { UkmaDataError } from "./UkmaDataError";

export function useCaseRecords(reviewCase: UkmaDataReviewCase) {
	const ids = caseRecordIds(reviewCase);
	return useUkmaDataRecordsList(
		{ ids: ids.join(",") },
		{ query: { ...NO_RETRY.query, enabled: ids.length > 0 } },
	);
}

function RecordName({ record }: Readonly<{ record: UkmaDataRecord }>) {
	if (record.title === null) {
		return (
			<p className="text-muted-foreground">
				Запису {record.id} немає ні на сайті, ні серед нових
			</p>
		);
	}
	return (
		<>
			<p className="font-medium break-words">
				{record.course_id ? (
					<a
						href={`/courses/${record.course_id}`}
						className="underline-offset-4 hover:underline"
					>
						{record.title}
					</a>
				) : (
					record.title
				)}
			</p>
			{record.place ? (
				<p className="break-words text-muted-foreground">{record.place}</p>
			) : null}
			{record.on_site ? null : (
				<p className="text-muted-foreground">
					Ще не на сайті, зʼявиться після застосування нових записів
				</p>
			)}
		</>
	);
}

function RecordRow({ record }: Readonly<{ record: UkmaDataRecord }>) {
	return (
		<li className="flex flex-col gap-1 px-4 py-3 text-sm sm:grid sm:grid-cols-[minmax(0,1fr)_7rem_6rem] sm:items-start sm:gap-x-4 sm:px-5">
			<div className="min-w-0">
				<RecordName record={record} />
			</div>
			<p className="text-muted-foreground sm:text-foreground">
				{record.semester ?? <span className="hidden sm:inline">—</span>}
			</p>
			<p className="text-muted-foreground tabular-nums sm:text-right sm:text-foreground">
				{record.ratings > 0 ? (
					countWith(record.ratings, RATINGS)
				) : (
					<span className="sm:hidden">Без оцінок</span>
				)}
				{record.ratings > 0 ? null : (
					<span aria-hidden="true" className="hidden sm:inline">
						—
					</span>
				)}
			</p>
		</li>
	);
}

function RecordList({
	label,
	records,
}: Readonly<{ label: string; records: readonly UkmaDataRecord[] }>) {
	return (
		<div>
			<div
				aria-hidden="true"
				className="hidden border-b px-5 py-2 text-sm text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1fr)_7rem_6rem] sm:gap-x-4"
			>
				<span>Дисципліна</span>
				<span>Семестр</span>
				<span className="text-right">Оцінки</span>
			</div>
			<ul aria-label={label} className="divide-y">
				{records.map((record) => (
					<RecordRow key={record.id} record={record} />
				))}
			</ul>
		</div>
	);
}

export function CaseRecords({
	reviewCase,
}: Readonly<{ reviewCase: UkmaDataReviewCase }>) {
	const found = useCaseRecords(reviewCase);
	if (found.isLoading) {
		return (
			<div
				role="status"
				aria-label="Завантажую записи справи"
				className="space-y-3 rounded-xl border bg-card p-5"
			>
				<Skeleton className="h-5 w-1/3" />
				<Skeleton className="h-4 w-2/3" />
				<Skeleton className="h-24 w-full" />
			</div>
		);
	}
	if (found.error) {
		return (
			<UkmaDataError
				error={found.error}
				title="Не вдалося завантажити записи справи"
				onRetry={() => void found.refetch()}
				isRetrying={found.isRefetching}
			/>
		);
	}
	const records = found.data?.items ?? [];
	const summary = recordsSummary(reviewCase, records);
	return (
		<section
			aria-labelledby="case-records"
			className="overflow-hidden rounded-xl border bg-card"
		>
			<div className="space-y-1 border-b px-4 py-3 sm:px-5">
				<h2 id="case-records" className="font-medium">
					{summary.heading}
				</h2>
				{summary.lines.map((line) => (
					<p key={line} className="text-sm text-muted-foreground">
						{line}
					</p>
				))}
			</div>
			{summary.subject ? (
				<div className="border-b">
					<RecordList label="Запис із САЗ" records={[summary.subject]} />
				</div>
			) : null}
			{summary.others.length > 0 ? (
				<>
					{summary.othersLabel ? (
						<p className="border-b px-4 py-2 text-sm text-muted-foreground sm:px-5">
							{summary.othersLabel}
						</p>
					) : null}
					<RecordList
						label={summary.othersLabel ?? summary.heading}
						records={summary.others}
					/>
				</>
			) : null}
		</section>
	);
}
