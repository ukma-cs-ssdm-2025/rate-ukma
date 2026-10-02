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

function coursesWaiting(count: number): string {
	const mod10 = count % 10;
	const mod100 = count % 100;
	if (mod10 === 1 && mod100 !== 11) return `Ще ${count} курс чекає`;
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
		return `Ще ${count} курси чекають`;
	return `Ще ${count} курсів чекають`;
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
							? "Відповіді до цього курсу не збережуться."
							: `${coursesWaiting(remaining)} на оцінку, по хвилині на кожен.`}
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
