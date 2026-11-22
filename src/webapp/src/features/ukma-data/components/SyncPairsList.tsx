import { useState } from "react";

import { useMutation } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";

import { Button } from "@/components/ui/Button";
import type { SyncQuestionCourse } from "@/lib/api/generated";
import { ukmaDataSyncQuestionsAnswerBulk } from "@/lib/api/generated";
import { useSyncQuestions } from "../hooks/useSyncQuestions";
import type { ConfirmRequest } from "../syncConfirm";
import { chunks, deskPair, matchesQuery } from "../syncDesk";
import { countWith, formatCount } from "../syncFormat";
import { viewParams } from "../syncParams";
import { pairsRequest } from "../syncRequests";
import { pageSlice } from "../syncRows";
import { cleanTitle, PAIRS, SEMESTERS } from "../syncWords";
import { DataBack, DataPager, DataViewHead } from "./DataBits";
import { SyncToggle } from "./SyncBits";
import { LIST_PAGE } from "./SyncChangeList";
import {
	DataSearch,
	DataTableEmpty,
	DataTableFrame,
	DataTableSkeleton,
	DataTd,
	DataTh,
	DataTitleCell,
} from "./DataTable";
import { UkmaDataError } from "./UkmaDataError";

const BULK_LIMIT = 500;

const pageDetail = (course: SyncQuestionCourse): string =>
	`${cleanTitle(course.department)} · ${countWith(course.offerings.length, SEMESTERS)}`;

async function saveAnswers(merged: number[], apart: number[]) {
	for (const ids of chunks(merged, BULK_LIMIT)) {
		await ukmaDataSyncQuestionsAnswerBulk({
			change_ids: ids,
			answer: "merge",
			into: "suggested",
		});
	}
	for (const ids of chunks(apart, BULK_LIMIT)) {
		await ukmaDataSyncQuestionsAnswerBulk({
			change_ids: ids,
			answer: "keep_apart",
		});
	}
}

export function SyncPairsList({
	onBack,
	onConfirm,
}: Readonly<{
	onBack: () => void;
	onConfirm: (request: ConfirmRequest) => void;
}>) {
	const [{ q, page }, setParams] = useQueryStates(viewParams);
	const questions = useSyncQuestions({ kinds: "merge_courses", rated: false });
	const [apart, setApart] = useState<ReadonlySet<number>>(new Set());
	const items = questions.data ?? [];
	const shown = pageSlice(
		items.filter((question) => matchesQuery(question, q)),
		page,
		LIST_PAGE,
	);
	const merged = items
		.map((question) => question.id)
		.filter((id) => !apart.has(id));
	const save = useMutation({
		mutationFn: () => saveAnswers(merged, [...apart]),
		onSuccess: () => onConfirm(pairsRequest(merged.length, apart.size)),
	});
	const toggle = (id: number, separate: boolean) => {
		const next = new Set(apart);
		if (separate) {
			next.add(id);
		} else {
			next.delete(id);
		}
		setApart(next);
	};
	const label =
		apart.size === 0
			? `Об'єднати всі ${formatCount(items.length)}`
			: `Застосувати ${formatCount(items.length)}`;
	return (
		<div className="space-y-5">
			<DataBack onBack={onBack}>Усі групи</DataBack>
			<DataViewHead
				title="Пари без оцінок"
				action={
					<Button
						size="lg"
						className="w-full sm:w-auto"
						disabled={items.length === 0 || save.isPending}
						onClick={() => save.mutate()}
					>
						{label}
					</Button>
				}
			>
				{countWith(items.length, PAIRS)} з однаковою назвою, де ні на одній
				сторінці немає оцінок. Об'єднання тут нічого не переносить зі
				студентських оцінок — лише прибирає зайву сторінку. Залишиться сторінка
				з кафедрою, як у САЗ.
			</DataViewHead>
			<DataSearch
				value={q}
				placeholder="Пошук за назвою"
				onChange={(value) => void setParams({ q: value, page: null })}
				className="max-w-xl"
			/>
			{save.isError ? (
				<p role="alert" className="text-sm text-destructive">
					Не вдалося зберегти рішення. Спробуйте ще раз.
				</p>
			) : null}
			{questions.isLoading ? <DataTableSkeleton /> : null}
			{questions.error ? (
				<UkmaDataError
					error={questions.error}
					title="Не вдалося завантажити пари"
					onRetry={() => void questions.refetch()}
					isRetrying={questions.isRefetching}
				/>
			) : null}
			{questions.data && shown.items.length === 0 ? (
				<DataTableEmpty>Нічого не знайдено</DataTableEmpty>
			) : null}
			{shown.items.length > 0 ? (
				<>
					<DataTableFrame>
						<thead>
							<tr>
								<DataTh>Сторінка 1</DataTh>
								<DataTh className="hidden md:table-cell">Сторінка 2</DataTh>
								<DataTh className="w-32 text-right sm:w-52">Рішення</DataTh>
							</tr>
						</thead>
						<tbody className="divide-y">
							{shown.items.map((question) => {
								const pair = deskPair(question, null);
								const other = pair?.gone[0];
								if (pair === null || other === undefined) {
									return null;
								}
								const decision = (
									<SyncToggle
										label={`Рішення: ${cleanTitle(pair.keep.title)}`}
										options={["Об'єднати", "Окремо"]}
										value={apart.has(question.id) ? 1 : 0}
										onChange={(value) => toggle(question.id, value === 1)}
									/>
								);
								return (
									<tr key={question.id}>
										<DataTd>
											<DataTitleCell
												title={cleanTitle(pair.keep.title)}
												detail={pageDetail(pair.keep)}
											/>
											<p className="mt-2 text-muted-foreground md:hidden">
												і {pageDetail(other)}
											</p>
										</DataTd>
										<DataTd className="hidden md:table-cell">
											<DataTitleCell
												title={cleanTitle(other.title)}
												detail={pageDetail(other)}
											/>
										</DataTd>
										<DataTd className="text-right">{decision}</DataTd>
									</tr>
								);
							})}
						</tbody>
					</DataTableFrame>
					<DataPager
						summary={`${formatCount(shown.from)}–${formatCount(shown.to)} з ${formatCount(items.length)} · окремо ${formatCount(apart.size)}`}
						page={shown.page}
						totalPages={shown.totalPages}
						onPage={(next) => void setParams({ page: next })}
					/>
				</>
			) : null}
		</div>
	);
}
