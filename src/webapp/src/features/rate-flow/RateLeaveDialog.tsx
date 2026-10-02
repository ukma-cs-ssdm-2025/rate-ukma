import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/AlertDialog";
import { ProgressBar } from "@/features/ratings/components/MyRatingsHeader";
import { pluralUk } from "./plural";

function coursesWaiting(count: number): string {
	return `Ще ${count} ${pluralUk(count, ["дисципліна чекає", "дисципліни чекають", "дисциплін чекають"])}`;
}

interface RateLeaveDialogProps {
	readonly open: boolean;
	readonly rated: number;
	readonly total: number;
	/** Courses still to rate, the open one included. */
	readonly remaining: number;
	/** The open course has answers that are not saved yet. */
	readonly hasDraft: boolean;
	readonly onStay: () => void;
	readonly onLeave: () => void;
}

/**
 * Asked once when the student leaves mid-queue: how far they got and what is
 * left, with staying as the easy choice. Leaving is one click.
 */
export function RateLeaveDialog({
	open,
	rated,
	total,
	remaining,
	hasDraft,
	onStay,
	onLeave,
}: Readonly<RateLeaveDialogProps>) {
	return (
		<AlertDialog open={open} onOpenChange={(next) => !next && onStay()}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Зупинитися на цьому?</AlertDialogTitle>
					<AlertDialogDescription>
						{hasDraft
							? "Відповіді до цієї дисципліни не збережуться."
							: `${coursesWaiting(remaining)} на оцінку, по хвилині на кожну.`}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<div className="text-center text-sm text-muted-foreground tabular-nums sm:text-left">
					Оцінено {rated} з {total}
					<ProgressBar share={total ? rated / total : 0} className="w-full" />
				</div>
				<AlertDialogFooter>
					<AlertDialogCancel onClick={onLeave}>Вийти</AlertDialogCancel>
					<AlertDialogAction onClick={onStay}>
						Продовжити оцінювати
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
