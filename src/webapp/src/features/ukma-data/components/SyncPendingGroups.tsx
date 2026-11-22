import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type {
	AnswerEnum,
	SyncChange,
	SyncChangeGroupEnum as Group,
	SyncSourceEnum as Source,
} from "@/lib/api/generated";
import {
	GROUP_LABELS,
	SOURCE_LABELS,
	SYNC_GROUPS,
	SYNC_SOURCES,
} from "../sync";
import { isTeacherChange, teacherUnitKey } from "../syncActions";
import { SyncChangeActions } from "./SyncChangeActions";
import { SyncChangeCard } from "./SyncChangeCard";

interface PendingGroupProps {
	changes: SyncChange[];
	selected: ReadonlySet<number>;
	busy: boolean;
	onSelect: (change: SyncChange, selected: boolean) => void;
	onApprove: (change: SyncChange) => void;
	onReject: (change: SyncChange) => void;
	onApproveMany: (changes: SyncChange[]) => void;
	onRejectMany: (changes: SyncChange[]) => void;
	onAnswer: (change: SyncChange, answer: AnswerEnum, into?: string) => void;
	onApproveFilter: (source: Source, group: Group, kind?: string) => void;
	onRejectFilter: (source: Source, group: Group, kind?: string) => void;
	onKeepApart: () => void;
}

interface ChangeCardProps {
	change: SyncChange;
	selected: ReadonlySet<number>;
	busy: boolean;
	onSelect: (change: SyncChange, selected: boolean) => void;
	onApprove: (change: SyncChange) => void;
	onReject: (change: SyncChange) => void;
	onAnswer: (change: SyncChange, answer: AnswerEnum, into?: string) => void;
}

function ChangeCard({
	change,
	selected,
	busy,
	onSelect,
	onApprove,
	onReject,
	onAnswer,
}: Readonly<ChangeCardProps>) {
	return (
		<SyncChangeCard
			change={change}
			selected={selected.has(change.id)}
			onSelectedChange={(next) => onSelect(change, next)}
			actions={
				<SyncChangeActions
					change={change}
					busy={busy}
					onApprove={onApprove}
					onReject={onReject}
					onAnswer={onAnswer}
				/>
			}
		/>
	);
}

function TeacherUnits({ changes, ...card }: Readonly<PendingGroupProps>) {
	const units = new Map<string, SyncChange[]>();
	for (const change of changes) {
		const key = teacherUnitKey(change);
		units.set(key, [...(units.get(key) ?? []), change]);
	}
	return (
		<div className="space-y-4">
			{[...units.entries()].map(([key, items]) => (
				<div key={key} className="space-y-2">
					<h3 className="flex flex-wrap items-center gap-2 text-sm font-medium">
						{items[0].target_id === null ? "Викладач" : "Вибірка"}
						<Badge variant="secondary">{items.length}</Badge>
						{items.length > 1 ? (
							<>
								<Button
									size="sm"
									disabled={card.busy}
									onClick={() => card.onApproveMany(items)}
								>
									Підтвердити вибірку
								</Button>
								<Button
									size="sm"
									variant="outline"
									disabled={card.busy}
									onClick={() => card.onRejectMany(items)}
								>
									Відхилити вибірку
								</Button>
							</>
						) : null}
					</h3>
					<p className="text-sm text-muted-foreground">
						Зміни викладачів однієї вибірки застосовуються разом.
					</p>
					<ul
						className="space-y-3"
						aria-label={`${SOURCE_LABELS.teachers}: ${
							items[0].target_id === null ? "Викладач" : "Вибірка"
						}`}
					>
						{items.map((change) => (
							<li key={change.id}>
								<ChangeCard change={change} {...card} />
							</li>
						))}
					</ul>
				</div>
			))}
		</div>
	);
}

function CatalogGroups({ changes, ...card }: Readonly<PendingGroupProps>) {
	return (
		<>
			{SYNC_GROUPS.map((group) => {
				const items = changes.filter((item) => item.group === group);
				if (items.length === 0) {
					return null;
				}
				const source = items[0].source;
				return (
					<div key={group} className="space-y-2">
						<div className="flex flex-wrap items-center gap-2">
							<h3 className="flex items-center gap-2 text-sm font-medium">
								{GROUP_LABELS[group]}
								<Badge variant="secondary">
									{items.length}
									<span className="sr-only"> на цій сторінці</span>
								</Badge>
							</h3>
							<Button
								size="sm"
								variant="outline"
								disabled={card.busy}
								aria-label={`Переглянути й застосувати групу: ${GROUP_LABELS[group]}`}
								onClick={() => card.onApproveFilter(source, group)}
							>
								{group === "removed"
									? "Позначити всі переглянутими"
									: "Переглянути й застосувати"}
							</Button>
							{group === "removed" ? null : (
								<Button
									size="sm"
									variant="ghost"
									disabled={card.busy}
									aria-label={`Відхилити групу: ${GROUP_LABELS[group]}`}
									onClick={() => card.onRejectFilter(source, group)}
								>
									Відхилити групу
								</Button>
							)}
							{group === "mapping" ? (
								<Button
									size="sm"
									variant="secondary"
									disabled={card.busy}
									onClick={card.onKeepApart}
								>
									Залишити окремо всі без оцінок
								</Button>
							) : null}
						</div>
						<ul
							className="space-y-3"
							aria-label={`${SOURCE_LABELS[source]}: ${GROUP_LABELS[group]}`}
						>
							{items.map((change) => (
								<li key={change.id}>
									<ChangeCard change={change} {...card} />
								</li>
							))}
						</ul>
					</div>
				);
			})}
		</>
	);
}

export function SyncPendingGroups(props: Readonly<PendingGroupProps>) {
	return (
		<div className="space-y-6">
			{SYNC_SOURCES.map((source) => {
				const items = props.changes.filter((item) => item.source === source);
				if (items.length === 0) {
					return null;
				}
				const teacherItems = items.filter(isTeacherChange);
				const catalogItems = items.filter((item) => !isTeacherChange(item));
				return (
					<section
						key={source}
						aria-label={SOURCE_LABELS[source]}
						className="space-y-3"
					>
						<h2 className="text-lg font-semibold">{SOURCE_LABELS[source]}</h2>
						{source === "teachers" ? (
							<TeacherUnits {...props} changes={teacherItems} />
						) : (
							<CatalogGroups {...props} changes={catalogItems} />
						)}
					</section>
				);
			})}
		</div>
	);
}
