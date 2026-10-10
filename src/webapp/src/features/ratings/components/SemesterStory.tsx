import { Share2, Star } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { DialogDescription, DialogTitle } from "@/components/ui/Dialog";
import { toast } from "@/components/ui/Toaster";
import { getSemesterDisplay } from "@/features/courses/courseFormatting";
import { cn } from "@/lib/utils";

export interface SemesterStoryRating {
	readonly title: string;
	readonly difficulty: number;
	readonly usefulness: number;
}

export interface SemesterStoryData {
	readonly year: number;
	readonly season: string;
	readonly ratings: readonly SemesterStoryRating[];
}

function disciplines(count: number) {
	const mod10 = count % 10;
	const mod100 = count % 100;
	if (mod10 === 1 && mod100 !== 11) return "дисципліна";
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
		return "дисципліни";
	return "дисциплін";
}

function pick(
	ratings: readonly SemesterStoryRating[],
	key: "difficulty" | "usefulness",
) {
	return ratings.reduce((best, item) => (item[key] > best[key] ? item : best));
}

function StoryCard({
	story,
	className,
}: Readonly<{ story: SemesterStoryData; className?: string }>) {
	const hardest = pick(story.ratings, "difficulty");
	const mostUseful = pick(story.ratings, "usefulness");

	return (
		<div
			className={cn(
				"flex aspect-[9/16] flex-col justify-between overflow-hidden rounded-2xl bg-primary p-6 text-primary-foreground",
				className,
			)}
		>
			<div className="flex items-center gap-2">
				<div className="flex size-8 items-center justify-center rounded-lg bg-primary-foreground/15">
					<Star className="size-4" fill="currentColor" aria-hidden="true" />
				</div>
				<span className="font-bold">Rate UKMA</span>
			</div>

			<div className="space-y-6">
				<div className="space-y-1">
					<p className="text-sm opacity-80">
						{getSemesterDisplay(story.year, story.season)}
					</p>
					<p className="text-3xl leading-tight font-bold text-balance">
						Мій семестр оцінено
					</p>
					<p className="text-sm opacity-80">
						{story.ratings.length} {disciplines(story.ratings.length)}
					</p>
				</div>

				<div className="space-y-3">
					<StoryFact label="Найскладніша" title={hardest.title} />
					<StoryFact label="Найкорисніша" title={mostUseful.title} />
				</div>
			</div>

			<p className="text-sm opacity-80">Оціни свої на rateukma.com</p>
		</div>
	);
}

function StoryFact({
	label,
	title,
}: Readonly<{ label: string; title: string }>) {
	return (
		<div className="rounded-xl bg-primary-foreground/10 p-3">
			<p className="text-xs opacity-80">{label}</p>
			<p className="font-semibold leading-snug">{title}</p>
		</div>
	);
}

export async function shareSemester() {
	const data = {
		title: "Rate UKMA",
		text: "Мій семестр оцінено на Rate UKMA. Оціни свої дисципліни теж",
		url: "https://rateukma.com",
	};
	try {
		if (navigator.share) await navigator.share(data);
		else {
			await navigator.clipboard.writeText(data.url);
			toast.success("Посилання скопійовано");
		}
	} catch {
		// The student closed the share sheet.
	}
}

/** A finished semester, offered as a story card in the thanks dialog. */
export function SemesterStoryTeaser({
	story,
	onOpen,
}: Readonly<{ story: SemesterStoryData; onOpen: () => void }>) {
	return (
		<div className="flex items-center gap-4 rounded-xl bg-muted/50 p-4">
			{/* The thumbnail is the real card, scaled down. */}
			<div
				aria-hidden="true"
				className="h-[107px] w-[60px] shrink-0 overflow-hidden rounded-lg"
			>
				<StoryCard
					story={story}
					className="w-[270px] origin-top-left scale-[0.2222]"
				/>
			</div>
			<div className="min-w-0 flex-1 space-y-3">
				<div className="space-y-1">
					<p className="font-semibold leading-snug">
						{getSemesterDisplay(story.year, story.season)} оцінено
					</p>
					<p className="text-sm text-muted-foreground">
						Поділіться підсумком у сторіс
					</p>
				</div>
				<Button variant="outline" size="sm" onClick={onOpen}>
					<Share2 className="size-4" aria-hidden="true" />
					Переглянути картку
				</Button>
			</div>
		</div>
	);
}

/** The full card in place of the thanks content. */
export function SemesterStoryView({
	story,
	onBack,
}: Readonly<{ story: SemesterStoryData; onBack: () => void }>) {
	return (
		<div className="space-y-5" data-testid="semester-story">
			<div className="space-y-2 pr-5">
				<DialogTitle className="leading-snug">Картка для сторіс</DialogTitle>
				<DialogDescription>
					Без оцінок і відгуків, тільки назви дисциплін
				</DialogDescription>
			</div>
			<StoryCard story={story} className="mx-auto w-full max-w-[280px]" />
			<div className="grid grid-cols-2 gap-3">
				<Button variant="outline" onClick={onBack}>
					Назад
				</Button>
				<Button onClick={shareSemester}>
					<Share2 className="size-4" aria-hidden="true" />
					Поділитися
				</Button>
			</div>
		</div>
	);
}
