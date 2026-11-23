import { useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useQueryState } from "nuqs";

import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import type { SyncSelectionGroupEnum } from "@/lib/api/generated";
import { ukmaDataSyncPreview } from "@/lib/api/generated";
import { kindLabel } from "../sync";
import {
	GROUP_ROW_LABEL,
	previewLoadText,
	previewReasons,
	previewSummary,
} from "../syncActions";
import { changesText } from "../syncOverview";
import { previewGroupParser, previewKindParser } from "../syncPreviewParams";
import { PREVIEW_QUERY_KEY } from "../syncQueries";
import { TERMS } from "../syncTerms";
import { PreviewClose, SyncPreviewActions } from "./SyncPreviewActions";
import { SyncPreviewRows } from "./SyncPreviewRows";
import { SyncQuestionList } from "./SyncQuestionList";
import { Ago } from "./Term";

function ViewOnly({ group }: Readonly<{ group: SyncSelectionGroupEnum }>) {
	const text =
		group === "mapping" ? (
			<>
				Питання вирішують у консолі: <code>catalog_sync answer</code>.
			</>
		) : group === "removed" ? (
			"Нічого не застосовувати: зниклі записи сайт не видаляє."
		) : (
			"Нічого не застосовувати."
		);
	return (
		<div className="space-y-3 rounded-xl border bg-card p-4 text-sm">
			<p>{text}</p>
			<PreviewClose />
		</div>
	);
}

export function SyncPreviewPage() {
	const [group] = useQueryState("group", previewGroupParser);
	const [kind] = useQueryState("kind", previewKindParser);
	const [decided, setDecided] = useState(false);
	const preview = useQuery({
		queryKey: [PREVIEW_QUERY_KEY, group, kind],
		queryFn: ({ signal }) =>
			ukmaDataSyncPreview({ source: "catalog", group, kind }, signal),
		retry: false,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
		staleTime: 0,
		gcTime: 0,
	});
	const run = preview.data?.run ?? null;
	const total = preview.data?.counts.total ?? null;
	const busy = preview.isLoading || preview.isFetching;
	const canAct =
		preview.data !== undefined &&
		!busy &&
		!preview.isError &&
		group !== "mapping" &&
		group !== "removed" &&
		preview.data.counts.applied > 0;
	const refresh = () => {
		setDecided(false);
		void preview.refetch();
	};
	return (
		<div className="min-w-0 space-y-4">
			<Button variant="ghost" size="sm" asChild>
				<Link to="/data/sync" search={{ tab: "pending" }}>
					<ArrowLeft />
					Усі групи
				</Link>
			</Button>
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<h2 className="text-lg font-semibold">
					{group === "other" ? TERMS.other.label : GROUP_ROW_LABEL[group]}
					{kind === null ? null : ` · ${kindLabel(kind)}`}
					{total === null ? null : ` · ${changesText(total)}`}
				</h2>
				{run === null ? null : (
					<p className="text-sm text-muted-foreground">
						{run.data_updated_at === null ? (
							run.age_hours === null ? null : (
								`Дані САЗ: ${run.age_hours} год тому`
							)
						) : (
							<>
								Дані САЗ станом на <Ago iso={run.data_updated_at} />
							</>
						)}
					</p>
				)}
			</div>
			{busy ? (
				<div className="space-y-3">
					<p role="status" className="text-sm text-muted-foreground">
						Завантажую…
					</p>
					<Skeleton className="h-40 rounded-xl" />
				</div>
			) : null}
			{preview.error && !busy ? (
				<div className="space-y-2 rounded-lg border bg-card p-4">
					<p className="text-sm">{previewLoadText(preview.error)}</p>
					<Button
						variant="outline"
						size="sm"
						onClick={() => void preview.refetch()}
					>
						Спробувати ще
					</Button>
				</div>
			) : null}
			{preview.data === undefined || busy || preview.isError ? null : (
				<>
					{decided ? null : (
						<>
							<div className="space-y-1 rounded-xl border bg-card p-4 text-sm">
								<p>{previewSummary(preview.data.counts).applied}</p>
								<p className="text-muted-foreground">
									{previewSummary(preview.data.counts).leftOut}
								</p>
								{previewReasons(preview.data).length > 0 ? (
									<ul
										aria-label="Що не увійде"
										className="space-y-0.5 text-muted-foreground"
									>
										{previewReasons(preview.data).map((reason) => (
											<li key={reason}>{reason}</li>
										))}
									</ul>
								) : null}
							</div>
							<SyncPreviewRows group={group} kind={kind} />
							{group === "mapping" ? (
								<section aria-label="Питання" className="space-y-3">
									<SyncQuestionList />
								</section>
							) : null}
						</>
					)}
					{canAct ? (
						<SyncPreviewActions
							group={group}
							kind={kind}
							preview={preview.data}
							onRefresh={refresh}
							onDecided={() => setDecided(true)}
						/>
					) : (
						<ViewOnly group={group} />
					)}
				</>
			)}
		</div>
	);
}
