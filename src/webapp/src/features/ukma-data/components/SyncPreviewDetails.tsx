import type { SyncPreviewResponse } from "@/lib/api/generated";
import { countWith, formatCount, PLANS, RATINGS } from "../syncFormat";
import { kindLabel } from "../sync";
import {
	previewApplyCount,
	previewSupersededCount,
	previewWaitCount,
} from "../syncReview";
import { supersededReasonLabel } from "../syncReasons";

export function SyncPreviewDetails({
	preview,
}: Readonly<{ preview: SyncPreviewResponse }>) {
	const kinds = Object.entries(preview.counts);
	const reasons = Object.entries(preview.superseded_reasons).filter(
		([, count]) => count > 0,
	);
	return (
		<div className="space-y-3 text-sm">
			<dl className="grid grid-cols-3 gap-2 text-center tabular-nums">
				<div className="rounded-md bg-muted p-2">
					<dt className="text-xs text-muted-foreground">буде застосовано</dt>
					<dd className="text-lg font-semibold">
						{formatCount(previewApplyCount(preview))}
					</dd>
				</div>
				<div className="rounded-md bg-muted p-2">
					<dt className="text-xs text-muted-foreground">чекатиме</dt>
					<dd className="text-lg font-semibold">
						{formatCount(previewWaitCount(preview))}
					</dd>
				</div>
				<div className="rounded-md bg-muted p-2">
					<dt className="text-xs text-muted-foreground">уже неактуальні</dt>
					<dd className="text-lg font-semibold">
						{formatCount(previewSupersededCount(preview))}
					</dd>
				</div>
			</dl>
			{kinds.length > 1 ? (
				<ul className="space-y-1" aria-label="За типом">
					{kinds.map(([kind, counts]) => (
						<li
							key={kind}
							className="flex flex-wrap justify-between gap-2 tabular-nums"
						>
							<span>{kindLabel(kind)}</span>
							<span className="text-muted-foreground">
								{formatCount(counts.apply)} · {formatCount(counts.wait)} ·{" "}
								{formatCount(counts.superseded)}
							</span>
						</li>
					))}
				</ul>
			) : null}
			{reasons.length > 0 ? (
				<ul
					className="space-y-1 text-muted-foreground"
					aria-label="Чому вже неактуальні"
				>
					{reasons.map(([reason, count]) => (
						<li key={reason} className="tabular-nums">
							{formatCount(count)} — {supersededReasonLabel(reason)}
						</li>
					))}
				</ul>
			) : null}
			{preview.ratings_moved > 0 || preview.plans_moved > 0 ? (
				<p className="rounded-md bg-caution/30 p-2 tabular-nums">
					Перейдуть до інших курсів: {countWith(preview.ratings_moved, RATINGS)}{" "}
					· {countWith(preview.plans_moved, PLANS)}.
				</p>
			) : null}
		</div>
	);
}
