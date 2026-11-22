import { useRef, useState } from "react";

import { useMutation } from "@tanstack/react-query";

import type { SyncQuestion } from "@/lib/api/generated";
import { ukmaDataSyncChangeAnswer } from "@/lib/api/generated";
import { deskAnswers } from "../syncDesk";
import type { DeskAnswer } from "../syncDesk";

export function useDeskAnswers(questions: readonly SyncQuestion[]) {
	const [local, setLocal] = useState<ReadonlyMap<number, DeskAnswer>>(
		new Map(),
	);
	const saving = useRef(new Set<number>());
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
		onSuccess: ({ id, value }) =>
			setLocal((known) => new Map(known).set(id, value)),
		onSettled: (_data, _error, { id }) => saving.current.delete(id),
	});
	const answer = (id: number, value: DeskAnswer, onSaved: () => void) => {
		if (saving.current.has(id)) {
			return;
		}
		saving.current.add(id);
		save.mutate({ id, value }, { onSuccess: onSaved });
	};
	return { answers: deskAnswers(questions, local), answer, save };
}
