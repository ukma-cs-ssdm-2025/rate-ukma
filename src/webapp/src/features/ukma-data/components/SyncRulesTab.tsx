import { Skeleton } from "@/components/ui/Skeleton";
import type { SyncChangeGroupEnum, SyncPolicy } from "@/lib/api/generated";
import {
	useUkmaDataSyncPoliciesList,
	useUkmaDataSyncPolicyChangesList,
} from "@/lib/api/generated";
import { kindLabel } from "../sync";
import { GROUP_LABELS } from "../syncLabels";
import { approverName, NO_RETRY } from "../syncOverview";
import type { TermName } from "../syncTerms";
import { Ago, DataSection, Term } from "./Term";
import { UkmaDataError } from "./UkmaDataError";

const MODE_WORDS = {
	auto: "авто",
	needs_approval: "потребує рішення",
} as const;

function modeTerm(policy: SyncPolicy): TermName {
	if (policy.never_auto) {
		return "never_auto";
	}
	return policy.mode;
}

const RULE_GROUPS = ["link", "new", "change", "mapping", "removed"] as const;

function PolicyGroup({
	group,
	policies,
}: Readonly<{ group: SyncChangeGroupEnum; policies: readonly SyncPolicy[] }>) {
	if (policies.length === 0) {
		return null;
	}
	return (
		<section className="space-y-2">
			<h3 className="text-sm font-medium">{GROUP_LABELS[group]}</h3>
			<ul
				aria-label={GROUP_LABELS[group]}
				className="divide-y rounded-xl border bg-card"
			>
				{policies.map((policy) => (
					<li
						key={policy.kind}
						className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-5"
					>
						<span className="min-w-0">{kindLabel(policy.kind)}</span>
						<span className="shrink-0 font-medium">
							<Term name={modeTerm(policy)} />
						</span>
					</li>
				))}
			</ul>
		</section>
	);
}

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
					{MODE_WORDS[change.new_mode]} ·{" "}
					{approverName(change.user_email, change.user_name)},{" "}
					<Ago iso={change.changed_at} />
				</li>
			))}
		</ul>
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
						Які зміни записуються щоночі самі, а які чекають людини. Правило
						змінюють у <Term name="console" />.
					</>
				}
			>
				{policies.isLoading ? <Skeleton className="h-64 rounded-xl" /> : null}
				<ul className="space-y-1 text-sm text-muted-foreground">
					<li>
						<span className="font-medium text-foreground">Авто</span>: сайт
						записує сам щоночі, якщо це не зачіпає оцінок.
					</li>
					<li>
						<span className="font-medium text-foreground">
							Потребує рішення
						</span>
						: чекає в «Чекають рішення»; правило можна перевести в авто.
					</li>
					<li>
						<span className="font-medium text-foreground">Лише вручну</span>:
						завжди вирішує людина, авто для цього типу заборонене.
					</li>
				</ul>
				{policies.data ? (
					<div className="space-y-4" aria-label="Правила за типом змін">
						{RULE_GROUPS.map((group) => (
							<PolicyGroup
								key={group}
								group={group}
								policies={policies.data.items.filter(
									(policy) => policy.group === group,
								)}
							/>
						))}
					</div>
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
