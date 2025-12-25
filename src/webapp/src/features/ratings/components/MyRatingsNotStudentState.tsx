import { UserX } from "lucide-react";

export function MyRatingsNotStudentState() {
	return (
		<div className="py-16 text-center">
			<div className="mx-auto max-w-md space-y-4">
				<div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted">
					<UserX className="h-10 w-10 text-muted-foreground" />
				</div>
				<div>
					<h3 className="text-lg font-semibold">
						Ви не зареєстровані як студент
					</h3>
					<p className="text-sm text-muted-foreground">
						Ваш обліковий запис не має доступу до оцінок. Зверніться до
						адміністратора, якщо це помилка.
					</p>
				</div>
			</div>
		</div>
	);
}
