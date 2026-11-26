import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";

import { buttonVariants } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import type { SyncSummary } from "@/lib/api/generated";
import { useUkmaDataReviewCasesList } from "@/lib/api/generated";
import { cn } from "@/lib/utils";
import { openCasesLine } from "../reviewCases";
import { formatCount, pluralForm } from "../syncFormat";
import { changesText, NO_RETRY, skippedReasons } from "../syncOverview";
import { inboxSteps, STEP_COPY } from "../syncSteps";
import { DataSection, Term } from "./Term";

function Skipped({ summary }: Readonly<{ summary: SyncSummary }>) {
	const reasons = skippedReasons(summary);
	if (reasons.length === 0) {
		return null;
	}
	const total = reasons.reduce((sum, reason) => sum + reason.count, 0);
	return (
		<p className="text-sm text-muted-foreground">
			<Term name="skipped" /> {formatCount(total)} рядків САЗ:{" "}
			{reasons
				.map(
					(reason) =>
						`${reason.label.toLowerCase()} ${formatCount(reason.count)}`,
				)
				.join(", ")}
			. Сайт зберігає лише їхню кількість, самі рядки виправляють у САЗ.
		</p>
	);
}

function InboxRow({
	title,
	text,
	count,
	link,
}: Readonly<{
	title: string;
	text: ReactNode;
	count: number | null;
	link: ReactNode;
}>) {
	return (
		<li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4 sm:flex-nowrap sm:px-5">
			<div className="min-w-0 flex-1 basis-full sm:basis-auto">
				<h3 className="font-medium">{title}</h3>
				<p className="text-sm text-muted-foreground">{text}</p>
			</div>
			{count === null ? null : (
				<span className="text-lg font-medium tabular-nums sm:w-24 sm:text-right">
					{formatCount(count)}
				</span>
			)}
			{link}
		</li>
	);
}

const STEPS_IN = { one: "кроці", few: "кроках", many: "кроках" };

const LINK_CLASS = cn(
	buttonVariants({ variant: "outline", size: "sm" }),
	"ml-auto sm:ml-0 sm:w-28",
);

function SyncInboxRow({ summary }: Readonly<{ summary: SyncSummary }>) {
	const steps = inboxSteps(summary);
	const total = steps.reduce((sum, item) => sum + item.count, 0);
	const next = steps.find((item) => STEP_COPY[item.step].decidable) ?? steps[0];
	if (next === undefined) {
		return (
			<InboxRow
				title="Оновлення з САЗ"
				text="Нічого не чекає. Наступне читання САЗ уночі."
				count={null}
				link={null}
			/>
		);
	}
	return (
		<InboxRow
			title="Оновлення з САЗ"
			text={`${changesText(total)} у ${formatCount(steps.length)} ${pluralForm(steps.length, STEPS_IN)}. Почніть з «${next.title}».`}
			count={total}
			link={
				<Link
					to="/data/sync/preview"
					search={{ step: next.step }}
					aria-label="Оновлення з САЗ: перейти до першого кроку"
					className={LINK_CLASS}
				>
					Перейти
				</Link>
			}
		/>
	);
}

function CasesInboxRow() {
	const cases = useUkmaDataReviewCasesList(
		{ status: "open", limit: 1 },
		NO_RETRY,
	);
	const link = (
		<Link to="/data/cases" aria-label="Справи: відкрити" className={LINK_CLASS}>
			Відкрити
		</Link>
	);
	if (cases.isLoading) {
		return (
			<InboxRow
				title="Справи"
				text={<Skeleton className="h-4 w-48" />}
				count={null}
				link={link}
			/>
		);
	}
	if (cases.error || cases.data === undefined) {
		return (
			<InboxRow
				title="Справи"
				text="Не вдалося завантажити: сервіс САЗ зараз не відповідає. Решта сторінки працює."
				count={null}
				link={link}
			/>
		);
	}
	const total = cases.data.total;
	return (
		<InboxRow
			title="Справи"
			text={
				total === 0
					? "Усі записи з САЗ зіставлено."
					: `${openCasesLine(total)}: схожі студенти чи семестри, що зникли.`
			}
			count={total}
			link={link}
		/>
	);
}

export function OverviewWaiting({
	summary,
	loading,
}: Readonly<{ summary: SyncSummary | null; loading: boolean }>) {
	return (
		<DataSection
			title="Що чекає людини"
			lead="Усе, що сайт не вирішує сам. Деталі — у розділах."
		>
			<ul
				aria-label="Що чекає рішення"
				className="divide-y overflow-hidden rounded-xl border bg-card"
			>
				{summary === null ? (
					<InboxRow
						title="Оновлення з САЗ"
						text={
							loading ? (
								<Skeleton className="h-4 w-48" />
							) : (
								"Поки нічого не чекає: зміни зʼявляться після першого читання САЗ."
							)
						}
						count={null}
						link={null}
					/>
				) : (
					<SyncInboxRow summary={summary} />
				)}
				<CasesInboxRow />
			</ul>
			{summary === null ? null : <Skipped summary={summary} />}
		</DataSection>
	);
}
