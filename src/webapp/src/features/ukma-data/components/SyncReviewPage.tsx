import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useQueryState } from "nuqs";

import { Button } from "@/components/ui/Button";
import { reviewFieldParser, reviewStepParser } from "../syncPreviewParams";
import { STEP_COPY } from "../syncSteps";
import { SyncChangeList } from "./SyncChangeList";
import { SyncQuestionList } from "./SyncQuestionList";

export function SyncReviewPage() {
	const [step] = useQueryState("step", reviewStepParser);
	const [field, setField] = useQueryState("field", reviewFieldParser);
	const copy = STEP_COPY[step];
	return (
		<div className="min-w-0 space-y-4">
			<Button variant="ghost" size="sm" asChild className="-ml-3">
				<Link to="/data/sync" search={{ tab: "pending" }}>
					<ArrowLeft />
					Чекають рішення
				</Link>
			</Button>
			<div className="space-y-1">
				<h2 className="text-lg font-medium">{copy.title}</h2>
				<p className="text-sm text-muted-foreground">{copy.hint}</p>
			</div>
			{step === "questions" ? (
				<SyncQuestionList />
			) : (
				<SyncChangeList
					key={step}
					step={step}
					field={field}
					onField={(next) => void setField(next)}
				/>
			)}
		</div>
	);
}
