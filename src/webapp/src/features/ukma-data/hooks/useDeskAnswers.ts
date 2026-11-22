import { useState } from "react";

import { useMutation } from "@tanstack/react-query";

import type { SyncQuestion } from "@/lib/api/generated";
import { ukmaDataSyncChangeAnswer } from "@/lib/api/generated";
import { deskAnswers } from "../syncDesk";
import type { DeskAnswer } from "../syncDesk";

export function useDeskAnswers(questions: readonly SyncQuestion[]) {
	const [local, setLocal] = useState<ReadonlyMap<number, DeskAnswer>>(
		new Map(),
	);
	const remember = (id: number, value: DeskAnswer) => {
		const next = new Map(local);
		next.set(id, value);
		setLocal(next);
	};
	const save = useMutation({
		mutationFn: async ({ id, value }: { id: number; value: DeskAnswer }) => {
			if (value.answer !== "none") {
				await ukmaDataSyncChangeAnswer(id, {
					answer: value.answer,
					into: value.into,
				});
			}
			return { id, value };
		},
		onSuccess: ({ id, value }) => remember(id, value),
	});
	return { answers: deskAnswers(questions, local), save };
}
