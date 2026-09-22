import { UserX } from "lucide-react";

import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/Empty";

export function MyRatingsNotStudentState() {
	return (
		<Empty className="border-0 py-16">
			<EmptyHeader className="max-w-md">
				<EmptyMedia variant="icon">
					<UserX />
				</EmptyMedia>
				<EmptyTitle>Ви не зареєстровані як студент</EmptyTitle>
				<EmptyDescription>
					Ваш обліковий запис не має доступу до оцінок. Зверніться до
					адміністратора, якщо це помилка.
				</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}
