import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import type { OfferingEvidence, ReviewCase } from "../api/schemas";
import { formatAcademicYear } from "../reviewCases";

const REMOVALS_SHOWN = 8;

const FIELDS: ReadonlyArray<{
	label: string;
	value: (offering: OfferingEvidence) => string;
}> = [
	{ label: "Назва", value: (o) => o.title },
	{ label: "Код САЗ", value: (o) => o.sazCode },
	{ label: "Рік", value: (o) => formatAcademicYear(o.academicYear) },
	{ label: "Кафедра", value: (o) => o.department },
	{ label: "Кредити", value: (o) => String(o.credits) },
	{ label: "Курс", value: (o) => o.courseId },
];

function OfferingCard({
	heading,
	offering,
	other,
}: Readonly<{
	heading: string;
	offering: OfferingEvidence;
	other?: OfferingEvidence;
}>) {
	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="text-base">{heading}</CardTitle>
			</CardHeader>
			<CardContent>
				<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
					{FIELDS.map((field) => {
						const value = field.value(offering);
						const differs = other !== undefined && field.value(other) !== value;
						return (
							<div key={field.label} className="contents">
								<dt className="text-muted-foreground">{field.label}</dt>
								<dd
									className={cn(
										"min-w-0 break-words",
										differs && "font-semibold text-primary",
									)}
								>
									{value}
								</dd>
							</div>
						);
					})}
				</dl>
			</CardContent>
		</Card>
	);
}

export function CaseEvidence({
	reviewCase,
	selectedInstructorId,
	onSelectInstructor,
}: Readonly<{
	reviewCase: ReviewCase;
	selectedInstructorId: string | null;
	onSelectInstructor: (id: string) => void;
}>) {
	switch (reviewCase.kind) {
		case "course_match":
			return (
				<div className="grid gap-4 md:grid-cols-2">
					<OfferingCard
						heading="Нова пропозиція"
						offering={reviewCase.subject}
						other={reviewCase.candidate}
					/>
					<OfferingCard
						heading="Можливо, той самий курс"
						offering={reviewCase.candidate}
						other={reviewCase.subject}
					/>
				</div>
			);
		case "instructor_match":
			return (
				<div className="grid gap-4 md:grid-cols-2">
					<div className="space-y-2">
						<OfferingCard heading="Пропозиція" offering={reviewCase.subject} />
						<p className="text-sm text-muted-foreground">
							Рядок викладачів на картці САЗ: «{reviewCase.sazTeacherLine}»
						</p>
					</div>
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-base">
								Викладачі з smart.ukma
							</CardTitle>
						</CardHeader>
						<CardContent>
							<fieldset className="space-y-2">
								<legend className="sr-only">Викладачі з smart.ukma</legend>
								{reviewCase.candidates.length === 0 ? (
									<p className="text-sm text-muted-foreground">
										Кандидатів немає.
									</p>
								) : null}
								{reviewCase.candidates.map((candidate) => (
									<label
										key={candidate.id}
										className="flex cursor-pointer gap-3 rounded-xl border p-3 text-sm has-checked:border-primary has-checked:bg-primary/5"
									>
										<input
											type="radio"
											name="instructor"
											className="mt-1 accent-primary"
											checked={selectedInstructorId === candidate.id}
											disabled={reviewCase.status !== "open"}
											onChange={() => onSelectInstructor(candidate.id)}
										/>
										<span className="min-w-0 space-y-0.5">
											<span className="block font-medium">
												{candidate.fullName}
											</span>
											<span className="block text-muted-foreground">
												{candidate.department}
											</span>
											<span className="block text-muted-foreground">
												Уже викладає: {candidate.teaches.join(", ") || "—"}
											</span>
										</span>
									</label>
								))}
							</fieldset>
						</CardContent>
					</Card>
				</div>
			);
		case "removals_held": {
			const limit = Math.floor(reviewCase.threshold * reviewCase.liveOfferings);
			const rest = reviewCase.offerings.length - REMOVALS_SHOWN;
			return (
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-base">
							Запуск хоче вилучити {reviewCase.offerings.length} з{" "}
							{reviewCase.liveOfferings} пропозицій{" "}
							{formatAcademicYear(reviewCase.academicYear)}, а поріг — {limit}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<ul className="divide-y text-sm">
							{reviewCase.offerings.slice(0, REMOVALS_SHOWN).map((offering) => (
								<li
									key={offering.id}
									className="flex flex-wrap justify-between gap-x-4 py-1.5"
								>
									<span className="min-w-0 break-words">{offering.title}</span>
									<span className="text-muted-foreground tabular-nums">
										САЗ {offering.sazCode}
									</span>
								</li>
							))}
						</ul>
						{rest > 0 ? (
							<p className="pt-2 text-sm text-muted-foreground">і ще {rest}</p>
						) : null}
					</CardContent>
				</Card>
			);
		}
	}
}
