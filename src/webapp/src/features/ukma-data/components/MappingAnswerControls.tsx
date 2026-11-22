import { useState } from "react";

import { Button } from "@/components/ui/Button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/Select";
import type { AnswerEnum, SyncChange } from "@/lib/api/generated";
import { ANSWER_LABELS, answersFor, mappingCourses } from "../syncActions";

export function MappingAnswerControls({
	change,
	busy,
	onAnswer,
}: Readonly<{
	change: SyncChange;
	busy: boolean;
	onAnswer: (answer: AnswerEnum, into?: string) => void;
}>) {
	const [into, setInto] = useState<string | null>(null);
	const answers = answersFor(change.kind);
	const courses = mappingCourses(change).filter((course) => course.id !== null);
	const chosen = into ?? courses[0]?.id ?? null;
	const needsCourse = answers.includes("merge") || answers.includes("place");
	if (answers.length === 0) {
		return null;
	}
	return (
		<div className="flex flex-wrap items-center gap-2">
			{needsCourse && courses.length > 0 ? (
				<Select value={chosen ?? ""} onValueChange={setInto}>
					<SelectTrigger
						aria-label="Курс для відповіді"
						className="w-full sm:w-64"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{courses.map((course) => (
							<SelectItem key={course.id} value={course.id ?? ""}>
								{course.title}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			) : null}
			{answers.map((answer) => {
				const settles = answer === "keep" || answer === "keep_apart";
				const requiresCourse = answer === "merge" || answer === "place";
				return (
					<Button
						key={answer}
						size="sm"
						variant={settles ? "outline" : "secondary"}
						disabled={busy || (requiresCourse && chosen === null)}
						onClick={() =>
							onAnswer(
								answer,
								requiresCourse ? (chosen ?? undefined) : undefined,
							)
						}
					>
						{ANSWER_LABELS[answer]}
					</Button>
				);
			})}
		</div>
	);
}
