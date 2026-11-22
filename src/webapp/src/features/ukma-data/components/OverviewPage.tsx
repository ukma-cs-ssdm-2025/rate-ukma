import { Link } from "@tanstack/react-router";
import axios from "axios";

import { Skeleton } from "@/components/ui/Skeleton";
import {
	useUkmaDataReviewCasesList,
	useUkmaDataStatusRetrieve,
	useUkmaDataSyncRunsList,
	useUkmaDataSyncSummary,
} from "@/lib/api/generated";
import { NO_RETRY } from "../syncOverview";
import { formatCount } from "../syncFormat";
import { failedRunLabel } from "../syncReasons";
import { OverviewApplied } from "./OverviewApplied";
import { OverviewTech } from "./OverviewTech";
import { OverviewWaiting } from "./OverviewWaiting";
import { Ago, DataSection, Term } from "./Term";
import { UkmaDataError } from "./UkmaDataError";

const isNotFound = (error: unknown): boolean =>
	axios.isAxiosError(error) && error.response?.status === 404;

function LatestFailure({
	currentRunId,
}: Readonly<{ currentRunId: number | null }>) {
	const runs = useUkmaDataSyncRunsList(
		{ source: "catalog", page_size: 1 },
		NO_RETRY,
	);
	const latest = runs.data?.items[0];
	if (latest?.status !== "failed" || latest.id === currentRunId) {
		return null;
	}
	return (
		<p className="text-sm text-destructive">
			Остання спроба читання <Ago iso={latest.started_at} /> не вдалася:{" "}
			{failedRunLabel(latest.error)}. Нижче — дані останнього вдалого. Якщо так
			буде й завтра, скажіть власнику UKMA Data.
		</p>
	);
}

function CasesLine() {
	const cases = useUkmaDataReviewCasesList(
		{ status: "open", limit: 1000 },
		NO_RETRY,
	);
	if (!cases.data) {
		return null;
	}
	const count = cases.data.items.length;
	return (
		<p className="text-sm text-muted-foreground">
			У UKMA Data відкритих <Term name="cases" />:{" "}
			<span className="font-medium text-foreground tabular-nums">
				{cases.data.has_more
					? `понад ${formatCount(count)}`
					: formatCount(count)}
			</span>
			.
		</p>
	);
}

export function OverviewPage() {
	const status = useUkmaDataStatusRetrieve(NO_RETRY);
	const summary = useUkmaDataSyncSummary({ source: "catalog" }, NO_RETRY);
	if (status.error) {
		return (
			<UkmaDataError
				error={status.error}
				title="Не вдалося завантажити огляд"
				onRetry={() => void status.refetch()}
				isRetrying={status.isRefetching}
			/>
		);
	}
	const run = summary.data?.run ?? null;
	return (
		<div className="min-w-0 space-y-8">
			<DataSection
				title="Що змінилось у САЗ"
				lead="Що знайшло останнє нічне читання САЗ, коли порівняло його з сайтом."
			>
				{summary.isLoading ? <Skeleton className="h-6 w-80" /> : null}
				{run === null && !summary.isLoading ? (
					<p className="text-sm">
						САЗ ще не читали. Перше нічне читання покаже тут, що змінилось.
					</p>
				) : null}
				{run === null ? null : (
					<p className="text-sm">
						Останнє вдале читання{" "}
						<Ago iso={run.finished_at ?? run.started_at} />
						{run.data_updated_at === null ? null : (
							<>
								{" "}
								· дані САЗ станом на <Ago iso={run.data_updated_at} />
							</>
						)}
						.
					</p>
				)}
				<LatestFailure currentRunId={run?.id ?? null} />
			</DataSection>
			{summary.error && !isNotFound(summary.error) ? (
				<UkmaDataError
					error={summary.error}
					title="Не вдалося завантажити зміни з САЗ"
					onRetry={() => void summary.refetch()}
					isRetrying={summary.isRefetching}
				/>
			) : (
				<OverviewWaiting
					summary={summary.data ?? null}
					loading={summary.isLoading}
				/>
			)}
			{run === null ? null : <OverviewApplied runId={run.id} />}
			<DataSection
				title="Справи UKMA Data"
				lead="Записи, які UKMA Data не зіставила сама. Їх теж вирішують у консолі."
			>
				<CasesLine />
			</DataSection>
			{status.data ? <OverviewTech status={status.data} /> : null}
			<p className="text-sm text-muted-foreground">
				Усі зміни по групах — у розділі{" "}
				<Link
					to="/data/sync"
					className="text-primary underline-offset-4 hover:underline"
				>
					Оновлення з САЗ
				</Link>
				.
			</p>
		</div>
	);
}
