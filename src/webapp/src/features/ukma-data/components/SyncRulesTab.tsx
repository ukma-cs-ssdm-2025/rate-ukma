import { useState } from "react";

import { useQueryClient } from "@tanstack/react-query";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import type { SyncPolicy } from "@/lib/api/generated";
import {
	useUkmaDataSyncPoliciesList,
	useUkmaDataSyncPolicyChangesList,
	useUkmaDataSyncPolicyUpdate,
} from "@/lib/api/generated";
import { kindLabel } from "../sync";
import { actionFailure } from "../syncActions";
import { invalidateSyncQueries } from "../syncQueries";
import { approverName, NO_RETRY } from "../syncOverview";
import { Ago, DataSection, Term } from "./Term";
import { UkmaDataError } from "./UkmaDataError";

const MODE_WORDS = {
	auto: "авто",
	needs_approval: "потребує рішення",
} as const;

function PolicyChanges() {
	const changes = useUkmaDataSyncPolicyChangesList({ page_size: 10 }, NO_RETRY);
	const items = changes.data?.items ?? [];
	if (items.length === 0) {
		return changes.data ? (
			<p className="text-sm text-muted-foreground">
				Правила ще ніхто не змінював.
			</p>
		) : null;
	}
	return (
		<ul aria-label="Зміни правил" className="space-y-1 text-sm">
			{items.map((change) => (
				<li key={change.id}>
					{kindLabel(change.kind)}: {MODE_WORDS[change.old_mode]} →{" "}
					{MODE_WORDS[change.new_mode]}.{" "}
					<span className="text-muted-foreground">
						{approverName(change.user_email)}, <Ago iso={change.changed_at} />
					</span>
				</li>
			))}
		</ul>
	);
}

function PolicyRow({ policy }: Readonly<{ policy: SyncPolicy }>) {
	const queryClient = useQueryClient();
	const [confirming, setConfirming] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const update = useUkmaDataSyncPolicyUpdate({
		mutation: {
			onSuccess: () => setError(null),
			onError: (failure) => setError(actionFailure(failure).text),
			onSettled: () => invalidateSyncQueries(queryClient),
		},
	});
	const label = kindLabel(policy.kind);
	const auto = policy.mode === "auto";
	const save = (mode: SyncPolicy["mode"]) =>
		update.mutate({ kind: policy.kind, data: { mode } });
	return (
		<li className="flex flex-col gap-1 px-4 py-2.5 text-sm sm:px-5">
			<div className="flex items-center justify-between gap-3">
				<span className="min-w-0">
					<span className="block">{label}</span>
					<span className="block text-muted-foreground">
						<Term name={policy.group} />
					</span>
				</span>
				{policy.never_auto ? (
					<span className="shrink-0 text-muted-foreground">
						<Term name="never_auto" />
					</span>
				) : (
					<label className="flex shrink-0 items-center gap-2">
						<span className={auto ? undefined : "text-muted-foreground"}>
							Авто
						</span>
						<Switch
							checked={auto}
							disabled={update.isPending}
							aria-label={`Авто: ${label}`}
							onCheckedChange={(next) =>
								next ? setConfirming(true) : save("needs_approval")
							}
						/>
					</label>
				)}
			</div>
			{error === null ? null : (
				<p role="alert" className="text-destructive">
					{error}
				</p>
			)}
			<ConfirmDialog
				open={confirming}
				onOpenChange={setConfirming}
				onConfirm={() => {
					setConfirming(false);
					save("auto");
				}}
				title={`Застосовувати «${label}» самостійно?`}
				description="Щоночі після читання САЗ сайт застосовуватиме такі зміни без людини. Вимкнути можна тут будь-коли, а кожне застосування буде в журналі."
				confirmText="Увімкнути авто"
				cancelText="Скасувати"
			/>
		</li>
	);
}

export function SyncRulesTab() {
	const policies = useUkmaDataSyncPoliciesList(NO_RETRY);
	if (policies.error) {
		return (
			<UkmaDataError
				error={policies.error}
				title="Не вдалося завантажити правила"
				onRetry={() => void policies.refetch()}
				isRetrying={policies.isRefetching}
			/>
		);
	}
	return (
		<div className="space-y-8">
			<DataSection
				title="Правила"
				lead={
					<>
						Які зміни записуються щоночі самі, а які чекають людини. Питання й
						зміни, що переносять оцінки, завжди вирішує людина.
					</>
				}
			>
				{policies.isLoading ? <Skeleton className="h-64 rounded-xl" /> : null}
				{policies.data ? (
					<ul
						aria-label="Правила за типом змін"
						className="divide-y rounded-xl border bg-card"
					>
						{policies.data.items.map((policy) => (
							<PolicyRow key={policy.kind} policy={policy} />
						))}
					</ul>
				) : null}
			</DataSection>
			<DataSection
				title="Хто змінював правила"
				lead="Останні зміни правил, новіші вгорі."
			>
				<PolicyChanges />
			</DataSection>
		</div>
	);
}
