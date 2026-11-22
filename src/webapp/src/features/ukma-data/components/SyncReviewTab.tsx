import axios from "axios";
import { CalendarClock } from "lucide-react";
import { useQueryStates } from "nuqs";

import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/Empty";
import { Skeleton } from "@/components/ui/Skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/ToggleGroup";
import type { SyncSourceEnum, SyncSummary } from "@/lib/api/generated";
import { useUkmaDataSyncSummary } from "@/lib/api/generated";
import { formatCount } from "../syncFormat";
import { SOURCE_LABELS } from "../syncLabels";
import { LIST_RESET, listParams, reviewParams } from "../syncParams";
import { isListStep, stepTarget, summaryTotal } from "../syncReview";
import type { ReviewStep } from "../syncReview";
import { SyncGroupList } from "./SyncGroupList";
import { SyncLaterStep } from "./SyncLaterStep";
import { SyncOverview } from "./SyncOverview";
import { SyncRunBanners, SyncRunHeader } from "./SyncRunHeader";
import { UkmaDataError } from "./UkmaDataError";

const SOURCES = [
	"catalog",
	"teachers",
] as const satisfies readonly SyncSourceEnum[];

const NEVER_RUN = {
	catalog: "Синхронізація каталогу ще не запускалась",
	teachers: "Синхронізація викладачів ще не запускалась",
} satisfies Record<SyncSourceEnum, string>;

const isNotFound = (error: unknown): boolean =>
	axios.isAxiosError(error) && error.response?.status === 404;

function SourceSwitch({
	source,
	totals,
	onChange,
}: Readonly<{
	source: SyncSourceEnum;
	totals: Record<SyncSourceEnum, number | null>;
	onChange: (source: SyncSourceEnum) => void;
}>) {
	return (
		<ToggleGroup
			type="single"
			variant="outline"
			value={source}
			aria-label="Джерело"
			onValueChange={(value) => {
				const next = SOURCES.find((item) => item === value);
				if (next !== undefined) {
					onChange(next);
				}
			}}
		>
			{SOURCES.map((item) => (
				<ToggleGroupItem key={item} value={item} className="gap-2 px-3">
					{SOURCE_LABELS[item]}
					{totals[item] === null ? null : (
						<span className="text-muted-foreground tabular-nums">
							{formatCount(totals[item] ?? 0)}
						</span>
					)}
				</ToggleGroupItem>
			))}
		</ToggleGroup>
	);
}

function OverviewSkeleton() {
	return (
		<div className="space-y-2" aria-busy="true" aria-label="Завантаження">
			{Array.from({ length: 5 }, (_, index) => (
				<Skeleton key={index} className="h-[5.5rem] rounded-lg" />
			))}
		</div>
	);
}

function ReviewBody({
	summary,
	source,
	group,
	question,
	onOpen,
	onOpenAnswers,
	onBack,
}: Readonly<{
	summary: SyncSummary;
	source: SyncSourceEnum;
	group: ReviewStep | null;
	question: string | null;
	onOpen: (step: ReviewStep) => void;
	onOpenAnswers: () => void;
	onBack: () => void;
}>) {
	if (group !== null && isListStep(group)) {
		return (
			<SyncGroupList
				step={group}
				source={source}
				summary={summary}
				onBack={onBack}
			/>
		);
	}
	if (group !== null || question !== null) {
		return <SyncLaterStep step={group} question={question} onBack={onBack} />;
	}
	return (
		<SyncOverview
			summary={summary}
			onOpenStep={onOpen}
			onOpenAnswers={onOpenAnswers}
		/>
	);
}

export function SyncReviewTab() {
	const [{ source, run, group, question }, setParams] = useQueryStates({
		...reviewParams,
		...listParams,
	});
	const pinned = (item: SyncSourceEnum) =>
		item === source && run !== null ? { source: item, run } : { source: item };
	const catalog = useUkmaDataSyncSummary(pinned("catalog"), {
		query: { retry: false },
	});
	const teachers = useUkmaDataSyncSummary(pinned("teachers"), {
		query: { retry: false },
	});
	const current = source === "catalog" ? catalog : teachers;
	const totals = {
		catalog: catalog.data ? summaryTotal(catalog.data) : null,
		teachers: teachers.data ? summaryTotal(teachers.data) : null,
	};
	const open = (step: ReviewStep) => {
		const target = stepTarget(step);
		void setParams({
			...LIST_RESET,
			group: target.param === "group" ? target.value : null,
			question: target.param === "question" ? target.value : null,
		});
	};
	const back = () =>
		void setParams({ ...LIST_RESET, group: null, question: null });
	return (
		<div className="min-w-0 space-y-4">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<SourceSwitch
					source={source}
					totals={totals}
					onChange={(next) =>
						void setParams({
							...LIST_RESET,
							source: next,
							run: null,
							group: null,
							question: null,
						})
					}
				/>
				{current.data ? <SyncRunHeader summary={current.data} /> : null}
			</div>
			{current.data ? (
				<SyncRunBanners
					summary={current.data}
					onLatest={() => void setParams({ ...LIST_RESET, run: null })}
				/>
			) : null}
			{current.isLoading ? <OverviewSkeleton /> : null}
			{current.error && isNotFound(current.error) ? (
				<Empty className="border">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<CalendarClock />
						</EmptyMedia>
						<EmptyTitle>{NEVER_RUN[source]}</EmptyTitle>
						<EmptyDescription>
							Перший запуск додасть зміни сюди.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : null}
			{current.error && !isNotFound(current.error) ? (
				<UkmaDataError
					error={current.error}
					title="Не вдалося завантажити розгляд"
					onRetry={() => void current.refetch()}
					isRetrying={current.isRefetching}
				/>
			) : null}
			{current.data ? (
				<ReviewBody
					summary={current.data}
					source={source}
					group={group}
					question={question}
					onOpen={open}
					onOpenAnswers={() =>
						void setParams({ ...LIST_RESET, group: null, question: "answers" })
					}
					onBack={back}
				/>
			) : null}
		</div>
	);
}
