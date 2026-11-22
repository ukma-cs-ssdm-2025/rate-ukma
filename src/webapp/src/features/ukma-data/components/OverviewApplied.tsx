import { Link } from "@tanstack/react-router";

import { Skeleton } from "@/components/ui/Skeleton";
import { useUkmaDataSyncRunApprovalsList } from "@/lib/api/generated";
import { approvalTerm, approverName, NO_RETRY } from "../syncOverview";
import { Ago, DataSection, Term } from "./Term";

const SHOWN = 5;

export function OverviewApplied({ runId }: Readonly<{ runId: number }>) {
	const approvals = useUkmaDataSyncRunApprovalsList(
		runId,
		{ page_size: SHOWN },
		NO_RETRY,
	);
	const items = approvals.data?.items ?? [];
	return (
		<DataSection
			title="Що застосовано"
			lead="Останні рішення за цим читанням: що, хто й коли."
		>
			{approvals.isLoading ? <Skeleton className="h-24 rounded-xl" /> : null}
			{approvals.data && items.length === 0 ? (
				<p className="text-sm">Рішень за цим читанням ще не було.</p>
			) : null}
			{items.length > 0 ? (
				<ul
					aria-label="Останні рішення"
					className="divide-y rounded-xl border bg-card"
				>
					{items.map((approval) => {
						const term = approvalTerm(approval);
						return (
							<li
								key={approval.id}
								className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:gap-3 sm:px-5"
							>
								<span className="w-28 shrink-0 font-medium">
									{term === null ? (
										<span className="text-destructive">Не вдалося</span>
									) : (
										<Term name={term} />
									)}
								</span>
								<span className="min-w-0 flex-1 break-words">
									{approval.selection}
								</span>
								<span className="shrink-0 text-muted-foreground">
									{approverName(approval.user_email)},{" "}
									<Ago iso={approval.created_at} />
								</span>
							</li>
						);
					})}
				</ul>
			) : null}
			{items.length > 0 ? (
				<Link
					to="/data/sync"
					search={{ tab: "history", openRun: runId }}
					className="text-sm text-primary underline-offset-4 hover:underline"
				>
					Усі рішення цього читання
				</Link>
			) : null}
		</DataSection>
	);
}
