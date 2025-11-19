interface MyRatingsHeaderProps {
	totalCourses: number;
	ratedCourses: number;
	isLoading: boolean;
}

export function MyRatingsHeader({
	totalCourses,
	ratedCourses,
	isLoading,
}: Readonly<MyRatingsHeaderProps>) {
	return (
		<div className="text-center max-w-2xl mx-auto space-y-2">
			<h1 className="text-4xl font-bold tracking-tight">Мої оцінки</h1>
			<p className="text-muted-foreground text-lg">
				Переглядайте оцінки курсів, які ви прослухали, та повертайтеся до них,
				щоб оновити свої враження.
			</p>
			{!isLoading && totalCourses > 0 ? (
				<p className="text-sm text-muted-foreground/80">
					Оцінено курсів:{" "}
					<span className="font-medium text-foreground">{ratedCourses}</span> з{" "}
					{totalCourses}
				</p>
			) : null}
		</div>
	);
}
