import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import type {
	SyncDecisionResponse,
	SyncPreviewResponse,
} from "@/lib/api/generated";
import type { ActionFailure } from "../syncActions";
import { CHANGES_ACCUSATIVE, countWith, formatCount } from "../syncFormat";
import { batchDoneText, previewLines } from "../syncSteps";

export interface Progress {
	applied: number;
	parts: number;
	planned: number;
}

export type Stage =
	| { kind: "checking"; progress: Progress | null }
	| { kind: "ready"; preview: SyncPreviewResponse }
	| { kind: "applying"; progress: Progress }
	| {
			kind: "done";
			response: SyncDecisionResponse;
			progress: Progress;
			stopped: boolean;
	  }
	| { kind: "failed"; failure: ActionFailure; progress: Progress | null };

export function JournalLink() {
	return (
		<Button variant="outline" asChild>
			<Link to="/data/sync" search={{ tab: "history" }}>
				Журнал
			</Link>
		</Button>
	);
}

function ProgressLine({ progress }: Readonly<{ progress: Progress }>) {
	return (
		<div className="space-y-2">
			<p role="status" className="flex items-center gap-2">
				<Spinner />
				{progress.parts === 0
					? "Застосовую…"
					: `Застосовано ${formatCount(progress.applied)} з ${formatCount(progress.planned)}, далі наступна частина…`}
			</p>
			{progress.planned > 0 ? (
				<div
					className="h-1.5 overflow-hidden rounded-full bg-muted"
					aria-hidden="true"
				>
					<div
						className="h-full bg-primary transition-[width] duration-200"
						style={{
							width: `${Math.min(100, (progress.applied / progress.planned) * 100)}%`,
						}}
					/>
				</div>
			) : null}
		</div>
	);
}

export function StageBody({ stage }: Readonly<{ stage: Stage }>) {
	if (stage.kind === "checking") {
		return stage.progress === null ? (
			<p role="status" className="flex items-center gap-2 text-sm">
				<Spinner /> Перевіряю, що застосується. Це може тривати до 30 с.
			</p>
		) : (
			<div className="text-sm">
				<ProgressLine progress={stage.progress} />
			</div>
		);
	}
	if (stage.kind === "applying") {
		return (
			<div className="text-sm">
				<ProgressLine progress={stage.progress} />
			</div>
		);
	}
	if (stage.kind === "failed") {
		return (
			<div className="space-y-2 text-sm">
				{stage.progress !== null && stage.progress.applied > 0 ? (
					<p>
						Уже застосовано{" "}
						{countWith(stage.progress.applied, CHANGES_ACCUSATIVE)}, вони
						лишаються.
					</p>
				) : null}
				<p role="alert" className="text-destructive">
					{stage.failure.text}
				</p>
			</div>
		);
	}
	if (stage.kind === "done") {
		return (
			<p role="status" className="text-sm">
				{stage.progress.parts > 1
					? batchDoneText(stage.progress, stage.stopped)
					: stage.response.detail}
			</p>
		);
	}
	const lines = previewLines(stage.preview);
	return (
		<div className="space-y-2 text-sm">
			<p>{lines.main}</p>
			{lines.notes.length > 0 ? (
				<ul className="space-y-1 text-muted-foreground">
					{lines.notes.map((note) => (
						<li key={note}>{note}</li>
					))}
				</ul>
			) : null}
		</div>
	);
}
