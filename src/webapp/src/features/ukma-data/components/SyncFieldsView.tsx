import { Button } from "@/components/ui/Button";
import type { SyncChangeGroupParts, SyncFieldRow } from "@/lib/api/generated";
import { cn } from "@/lib/utils";
import type { ConfirmRequest } from "../syncConfirm";
import { countWith, formatCount } from "../syncFormat";
import {
	blankTitle,
	fieldLabel,
	fieldLines,
	MOVING_FIELDS,
	valueText,
} from "../syncFields";
import type { FieldLine } from "../syncFields";
import { clearRequest, fieldRequest, keepRequest } from "../syncRequests";
import { SEMESTERS } from "../syncWords";
import { SyncBack, SyncViewHead } from "./SyncBits";

function PairChips({ row }: Readonly<{ row: SyncFieldRow }>) {
	return (
		<ul className="flex flex-wrap gap-2">
			{row.pairs.map((pair) => (
				<li
					key={`${pair.before}-${pair.after}`}
					className="rounded-md border bg-background px-2.5 py-1 text-sm"
				>
					<s className="text-muted-foreground">
						{valueText(row.field, pair.before)}
					</s>
					{" → "}
					<strong className="font-semibold">
						{valueText(row.field, pair.after)}
					</strong>
					<span className="text-muted-foreground">
						{" "}
						· {formatCount(pair.count)}
					</span>
				</li>
			))}
		</ul>
	);
}

function LineActions({
	line,
	onOpen,
	onConfirm,
}: Readonly<{
	line: FieldLine;
	onOpen: (field: string, blanks: boolean) => void;
	onConfirm: (request: ConfirmRequest) => void;
}>) {
	const { row } = line;
	if (line.blanking) {
		return (
			<>
				<Button onClick={() => onConfirm(keepRequest(row))}>
					Залишити як є
				</Button>
				<Button variant="outline" onClick={() => onConfirm(clearRequest(row))}>
					Очистити {formatCount(row.count)}
				</Button>
			</>
		);
	}
	return (
		<>
			<Button variant="outline" onClick={() => onOpen(row.field, false)}>
				Переглянути
			</Button>
			<Button onClick={() => onConfirm(fieldRequest(row))}>
				Підтвердити {formatCount(row.count)}
			</Button>
		</>
	);
}

function Line({
	line,
	onOpen,
	onConfirm,
}: Readonly<{
	line: FieldLine;
	onOpen: (field: string, blanks: boolean) => void;
	onConfirm: (request: ConfirmRequest) => void;
}>) {
	const { row } = line;
	const title = line.blanking ? blankTitle(row.field) : fieldLabel(row.field);
	return (
		<li
			className={cn(
				"flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between",
				line.blanking && "bg-tint-caution",
			)}
		>
			<div className="min-w-0 space-y-2">
				<h3 className="font-semibold">
					{title}
					<span className="font-normal text-muted-foreground">
						{" · "}
						{countWith(row.count, SEMESTERS)}
					</span>
				</h3>
				<PairChips row={row} />
				{line.blanking ? (
					<p className="text-sm text-tint-caution-foreground">
						Якщо підтвердити, на сайті поле стане порожнім. Краще залишити як є:
						сайт збереже нинішнє значення, а якщо САЗ знову його заповнить —
						зміна прийде сама.
					</p>
				) : null}
				{!line.blanking && MOVING_FIELDS.has(row.field) ? (
					<p className="text-sm text-tint-caution-foreground">
						Семестр переїде в інший рік чи сезон; оцінки залишаються з ним.
					</p>
				) : null}
			</div>
			<div className="flex shrink-0 flex-col gap-2 sm:flex-row">
				<LineActions line={line} onOpen={onOpen} onConfirm={onConfirm} />
			</div>
		</li>
	);
}

export function SyncFieldsView({
	changes,
	onBack,
	onOpen,
	onConfirm,
}: Readonly<{
	changes: SyncChangeGroupParts;
	onBack: () => void;
	onOpen: (field: string, blanks: boolean) => void;
	onConfirm: (request: ConfirmRequest) => void;
}>) {
	const lines = fieldLines(changes.by_field, changes.blanking);
	return (
		<div className="space-y-5">
			<SyncBack onBack={onBack} />
			<SyncViewHead title="Оновлені дані семестрів">
				У САЗ змінились подробиці {countWith(changes.total, SEMESTERS)}.
				Згруповано за тим, що саме змінилось. Оцінки ці зміни не зачіпають.
			</SyncViewHead>
			<ul className="divide-y overflow-hidden rounded-xl border bg-card">
				{lines.map((line) => (
					<Line
						key={`${line.row.field}-${String(line.blanking)}`}
						line={line}
						onOpen={onOpen}
						onConfirm={onConfirm}
					/>
				))}
			</ul>
			<p className="text-sm text-muted-foreground">
				Кожен рядок — це семестри, де змінилось це поле. Дія застосовується до
				семестру цілком: інші поля, що змінились у ньому, оновляться або
				залишаться як є разом із цим.
			</p>
		</div>
	);
}
