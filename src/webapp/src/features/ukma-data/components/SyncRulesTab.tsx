import { useState } from "react";

import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Lock } from "lucide-react";
import { parseAsInteger, useQueryStates } from "nuqs";

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/Empty";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toaster";
import { Toggle } from "@/components/ui/Toggle";
import type {
	ErrorEnvelope,
	SyncPolicy,
	SyncPolicyModeEnum,
} from "@/lib/api/generated";
import {
	getUkmaDataSyncPoliciesListQueryKey,
	getUkmaDataSyncPolicyChangesListQueryKey,
	useUkmaDataSyncPoliciesList,
	useUkmaDataSyncPolicyChangesList,
	useUkmaDataSyncPolicyUpdate,
} from "@/lib/api/generated";
import { formatDateTime } from "../reviewCases";
import {
	GROUP_LABELS,
	kindLabel,
	MODE_LABELS,
	NEVER_AUTO_REASON,
	PAGE_SIZE,
	SOURCE_LABELS,
	SYNC_SOURCES,
} from "../sync";
import { SyncPagination } from "./SyncPagination";
import { UkmaDataError } from "./UkmaDataError";

const auditParams = { page: parseAsInteger.withDefault(1) };

function policyErrorMessage(error: unknown): string {
	if (!axios.isAxiosError<ErrorEnvelope>(error)) {
		return "Не вдалося змінити правило.";
	}
	const envelope: ErrorEnvelope | undefined = error.response?.data;
	return (
		envelope?.fields?.mode?.[0] ??
		envelope?.detail ??
		"Не вдалося змінити правило."
	);
}

function PolicyRow({
	policy,
	onChange,
}: Readonly<{
	policy: SyncPolicy;
	onChange: (policy: SyncPolicy, next: SyncPolicyModeEnum) => void;
}>) {
	const next: SyncPolicyModeEnum =
		policy.mode === "auto" ? "needs_approval" : "auto";
	return (
		<li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
			<div className="min-w-0 space-y-1">
				<p className="font-medium">{kindLabel(policy.kind)}</p>
				<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
					<Badge variant="outline">{GROUP_LABELS[policy.group]}</Badge>
					<span>{MODE_LABELS[policy.mode]}</span>
					{policy.updated_at === null ? null : (
						<span>змінено {formatDateTime(policy.updated_at)}</span>
					)}
				</div>
				{policy.never_auto ? (
					<p className="flex items-center gap-1 text-xs text-muted-foreground">
						<Lock className="size-3" />
						Завжди з підтвердженням
					</p>
				) : null}
			</div>
			<Toggle
				variant="outline"
				pressed={policy.mode === "auto"}
				disabled={policy.never_auto}
				onPressedChange={() => onChange(policy, next)}
				aria-label={`Змінити режим: ${kindLabel(policy.kind)}`}
			>
				{policy.mode === "auto" ? "Авто" : "Вручну"}
			</Toggle>
		</li>
	);
}

function PolicyAudit() {
	const [{ page }, setParams] = useQueryStates(auditParams);
	const { data, isLoading, error, refetch, isRefetching } =
		useUkmaDataSyncPolicyChangesList(
			{ page, page_size: PAGE_SIZE },
			{ query: { retry: false } },
		);
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Історія змін правил</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				{isLoading ? <Skeleton className="h-24" /> : null}
				{error ? (
					<UkmaDataError
						error={error}
						title="Не вдалося завантажити історію правил"
						onRetry={refetch}
						isRetrying={isRefetching}
					/>
				) : null}
				{data && !error && data.items.length === 0 ? (
					<Empty>
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<Lock />
							</EmptyMedia>
							<EmptyTitle>Змін правил ще не було</EmptyTitle>
							<EmptyDescription>
								Кожна зміна режиму запишеться сюди.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : null}
				{data && !error && data.items.length > 0 ? (
					<>
						<ul className="space-y-2 text-sm" aria-label="Зміни правил">
							{data.items.map((change) => (
								<li
									key={change.id}
									className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b pb-2 last:border-b-0"
								>
									<span className="text-muted-foreground">
										{formatDateTime(change.changed_at)}
									</span>
									<span>{change.user_email}</span>
									<Badge variant="soft">{kindLabel(change.kind)}</Badge>
									<span className="text-muted-foreground">
										{MODE_LABELS[change.old_mode]} →{" "}
										{MODE_LABELS[change.new_mode]}
									</span>
								</li>
							))}
						</ul>
						<SyncPagination
							page={data.page}
							totalPages={data.total_pages}
							nextPage={data.next_page}
							previousPage={data.previous_page}
							onPageChange={(next) => setParams({ page: next })}
						/>
					</>
				) : null}
			</CardContent>
		</Card>
	);
}

export function SyncRulesTab() {
	const queryClient = useQueryClient();
	const [pending, setPending] = useState<{
		policy: SyncPolicy;
		next: SyncPolicyModeEnum;
	} | null>(null);
	const [error, setError] = useState<string | null>(null);
	const {
		data,
		isLoading,
		error: loadError,
		refetch,
		isRefetching,
	} = useUkmaDataSyncPoliciesList({ query: { retry: false } });

	const mutation = useUkmaDataSyncPolicyUpdate({
		mutation: {
			onSuccess: async () => {
				setError(null);
				setPending(null);
				await Promise.all([
					queryClient.invalidateQueries({
						queryKey: getUkmaDataSyncPoliciesListQueryKey(),
					}),
					queryClient.invalidateQueries({
						queryKey: getUkmaDataSyncPolicyChangesListQueryKey(),
					}),
				]);
				toast.success("Правило збережено");
			},
			onError: (mutationError) => {
				setError(policyErrorMessage(mutationError));
				setPending(null);
			},
		},
	});

	const policies = data?.items ?? [];
	return (
		<div className="space-y-4">
			{error === null ? null : (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			)}
			<p className="text-sm text-muted-foreground">{NEVER_AUTO_REASON}.</p>
			{isLoading ? <Skeleton className="h-64 rounded-xl" /> : null}
			{loadError ? (
				<UkmaDataError
					error={loadError}
					title="Не вдалося завантажити правила"
					onRetry={refetch}
					isRetrying={isRefetching}
				/>
			) : null}
			{policies.length === 0 && data && !loadError ? (
				<Empty className="border">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<Lock />
						</EmptyMedia>
						<EmptyTitle>Правил ще немає</EmptyTitle>
						<EmptyDescription>
							Сервер не повернув жодного типу змін.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : null}
			{policies.length > 0 && !loadError
				? SYNC_SOURCES.map((source) => {
						const items = policies.filter((item) => item.source === source);
						if (items.length === 0) {
							return null;
						}
						return (
							<section key={source} className="space-y-2">
								<h2 className="text-lg font-semibold">
									{SOURCE_LABELS[source]}
								</h2>
								<ul
									className="space-y-2"
									aria-label={`Правила: ${SOURCE_LABELS[source]}`}
								>
									{items.map((policy) => (
										<PolicyRow
											key={policy.kind}
											policy={policy}
											onChange={(item, next) =>
												setPending({ policy: item, next })
											}
										/>
									))}
								</ul>
							</section>
						);
					})
				: null}
			{data && !loadError ? <PolicyAudit /> : null}
			<ConfirmDialog
				open={pending !== null}
				onOpenChange={(open) => {
					if (!open) {
						setPending(null);
					}
				}}
				onConfirm={() => {
					if (pending === null) {
						return;
					}
					mutation.mutate({
						kind: pending.policy.kind,
						data: { mode: pending.next },
					});
				}}
				title="Змінити правило?"
				description={
					pending === null
						? ""
						: `Тип «${kindLabel(pending.policy.kind)}» ${
								pending.next === "auto"
									? "застосовуватиметься автоматично, без підтвердження."
									: "знову потребуватиме підтвердження."
							}`
				}
				confirmText="Змінити"
			/>
		</div>
	);
}
