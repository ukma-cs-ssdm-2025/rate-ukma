import { useState } from "react";

import { useQueryStates } from "nuqs";

import { Button } from "@/components/ui/Button";
import type {
	SyncSelectionFilter,
	SyncSummaryGroups,
} from "@/lib/api/generated";
import { useUkmaDataSyncPendingList } from "@/lib/api/generated";
import type { ConfirmRequest } from "../syncConfirm";
import { countWith, formatCount } from "../syncFormat";
import type { ListSegment } from "../syncParams";
import { viewParams } from "../syncParams";
import { NEW_KINDS, newRequest, SELECTION_LIMIT } from "../syncRequests";
import { tableRow, YEAR_RANGES, yearFilter, yearRangeLabel } from "../syncRows";
import { DISCIPLINES, SEMESTERS } from "../syncWords";
import {
	SyncBack,
	SyncPager,
	SyncSegments,
	SyncToggle,
	SyncViewHead,
} from "./SyncBits";
import { LIST_PAGE } from "./SyncChangeList";
import {
	SyncSearch,
	SyncTableEmpty,
	SyncTableFrame,
	SyncTableSkeleton,
	SyncTd,
	SyncTh,
	SyncTitleCell,
} from "./SyncTable";
import { UkmaDataError } from "./UkmaDataError";

export function defaultSegment(groups: SyncSummaryGroups): ListSegment {
	return groups.new.offerings > 0 ? "offerings" : "courses";
}

export function SyncNewList({
	groups,
	onBack,
	onConfirm,
}: Readonly<{
	groups: SyncSummaryGroups;
	onBack: () => void;
	onConfirm: (request: ConfirmRequest) => void;
}>) {
	const [params, setParams] = useQueryStates(viewParams);
	const segment = params.segment ?? defaultSegment(groups);
	const [skipped, setSkipped] = useState<ReadonlySet<number>>(new Set());
	const byYear = segment === "offerings";
	const years = byYear ? yearFilter(params.years) : {};
	const filter: SyncSelectionFilter = {
		group: "new",
		kind: NEW_KINDS[segment],
		q: params.q || null,
		year_from: years.year_from ?? null,
		year_to: years.year_to ?? null,
	};
	const list = useUkmaDataSyncPendingList(
		{
			source: "catalog",
			group: "new",
			kind: NEW_KINDS[segment],
			q: params.q || undefined,
			...years,
			page: params.page,
			page_size: LIST_PAGE,
		},
		{ query: { retry: false } },
	);
	const data = list.data;
	const total = data?.total ?? 0;
	const forms = segment === "offerings" ? SEMESTERS : DISCIPLINES;
	const adding = Math.max(0, total - skipped.size);
	const skipFull = skipped.size >= SELECTION_LIMIT;
	const toggle = (id: number, skip: boolean) => {
		const next = new Set(skipped);
		if (skip && skipFull) {
			return;
		}
		if (skip) {
			next.add(id);
		} else {
			next.delete(id);
		}
		setSkipped(next);
	};
	const reset = (patch: Partial<typeof params>) => {
		setSkipped(new Set());
		void setParams({ ...patch, page: null });
	};
	const from = data ? (data.page - 1) * data.page_size + 1 : 0;
	return (
		<div className="space-y-5">
			<SyncBack onBack={onBack} />
			<SyncViewHead
				title="Нове на сайті"
				action={
					<Button
						size="lg"
						className="w-full sm:w-auto"
						disabled={
							data === undefined || (adding === 0 && skipped.size === 0)
						}
						onClick={() =>
							onConfirm(newRequest(segment, filter, total, [...skipped]))
						}
					>
						Додати {countWith(adding, forms)}
					</Button>
				}
			>
				Цих дисциплін і семестрів на сайті ще немає. Серед них є й минулі
				семестри (з 2018 року), яких сайт раніше не мав — вони з'являться в
				історії дисципліни.
			</SyncViewHead>
			<div className="flex flex-col gap-3 lg:flex-row lg:items-center">
				<SyncSegments
					label="Що показати"
					value={segment}
					onChange={(value) => reset({ segment: value })}
					items={[
						{
							value: "courses",
							label: "Дисципліни",
							count: groups.new.courses,
						},
						{
							value: "offerings",
							label: "Семестри",
							count: groups.new.offerings,
						},
					]}
				/>
				{byYear ? (
					<SyncSegments
						label="Роки"
						value={params.years}
						onChange={(value) => reset({ years: value })}
						items={YEAR_RANGES.map((range) => ({
							value: range,
							label: yearRangeLabel(range),
						}))}
					/>
				) : null}
				<SyncSearch
					value={params.q}
					placeholder="Пошук за назвою або кодом САЗ"
					onChange={(value) => reset({ q: value })}
				/>
			</div>
			{list.isLoading ? <SyncTableSkeleton /> : null}
			{list.error ? (
				<UkmaDataError
					error={list.error}
					title="Не вдалося завантажити список"
					onRetry={() => void list.refetch()}
					isRetrying={list.isRefetching}
				/>
			) : null}
			{data && data.items.length === 0 ? (
				<SyncTableEmpty>Нічого не знайдено</SyncTableEmpty>
			) : null}
			{data && data.items.length > 0 ? (
				<>
					<SyncTableFrame>
						<thead>
							<tr>
								<SyncTh>Дисципліна</SyncTh>
								<SyncTh className="hidden w-32 md:table-cell">Семестр</SyncTh>
								<SyncTh className="hidden w-32 md:table-cell">
									Рік навчання
								</SyncTh>
								<SyncTh className="hidden w-28 md:table-cell">Код САЗ</SyncTh>
								<SyncTh className="w-32 text-right sm:w-56">Рішення</SyncTh>
							</tr>
						</thead>
						<tbody className="divide-y">
							{data.items.map((change) => {
								const row = tableRow(change, null);
								const skip = skipped.has(row.id);
								const decision = (
									<SyncToggle
										label={`Рішення: ${row.title}`}
										options={["Додати", "Пропустити"]}
										value={skip ? 1 : 0}
										onChange={(value) => toggle(row.id, value === 1)}
									/>
								);
								return (
									<tr
										key={row.id}
										className={skip ? "text-muted-foreground" : undefined}
									>
										<SyncTd>
											<SyncTitleCell
												title={row.title}
												detail={row.department}
											/>
											<p className="text-muted-foreground md:hidden">
												{[row.semester, row.studyYear, row.sazCode]
													.filter(Boolean)
													.join(" · ")}
											</p>
										</SyncTd>
										<SyncTd className="hidden md:table-cell">
											{row.semester}
										</SyncTd>
										<SyncTd className="hidden md:table-cell">
											{row.studyYear}
										</SyncTd>
										<SyncTd className="hidden tabular-nums md:table-cell">
											{row.sazCode}
										</SyncTd>
										<SyncTd className="text-right">{decision}</SyncTd>
									</tr>
								);
							})}
						</tbody>
					</SyncTableFrame>
					{skipFull ? (
						<p className="text-muted-foreground text-sm">
							За один раз можна пропустити до {formatCount(SELECTION_LIMIT)}{" "}
							записів. Додайте ці, а решту пропустіть наступним кроком.
						</p>
					) : null}
					<SyncPager
						summary={`${formatCount(from)}–${formatCount(from + data.items.length - 1)} з ${formatCount(total)} · пропущено ${formatCount(skipped.size)}`}
						page={data.page}
						totalPages={data.total_pages}
						onPage={(next) => void setParams({ page: next })}
					/>
				</>
			) : null}
		</div>
	);
}
