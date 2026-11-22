import { ArrowLeft, Construction } from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/Empty";
import { STEP_TITLES } from "../syncReview";
import type { ReviewStep } from "../syncReview";

export function SyncLaterStep({
	step,
	question,
	onBack,
}: Readonly<{
	step: ReviewStep | null;
	question: string | null;
	onBack: () => void;
}>) {
	const title =
		step === null
			? question === "answers"
				? "Ваші відповіді"
				: "Питання"
			: STEP_TITLES[step];
	return (
		<div className="space-y-4">
			<Button variant="ghost" size="sm" onClick={onBack}>
				<ArrowLeft />
				Розгляд
			</Button>
			<Empty className="border">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<Construction />
					</EmptyMedia>
					<EmptyTitle>{title}</EmptyTitle>
					<EmptyDescription>
						Цей екран зʼявиться в наступному оновленні.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		</div>
	);
}
