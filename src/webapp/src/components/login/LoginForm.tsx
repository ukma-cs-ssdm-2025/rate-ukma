"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/Form";
import { Input } from "@/components/ui/Input";

const loginSchema = z.object({
	username: z.string().min(1, "Username is required"),
	password: z.string().min(1, "Password is required"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

type LoginFormProps = {
	loginWithDjango: (username: string, password: string) => Promise<unknown>;
	onCancel: () => void;
};

export function LoginForm({ loginWithDjango, onCancel }: LoginFormProps) {
	const [showPassword, setShowPassword] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	const form = useForm<LoginFormValues>({
		resolver: zodResolver(loginSchema),
		defaultValues: {
			username: "",
			password: "",
		},
	});

	const isSubmitting = form.formState.isSubmitting;

	const handleSubmit = form.handleSubmit(async (values) => {
		setFormError(null);

		try {
			await loginWithDjango(values.username, values.password);
		} catch (error) {
			console.error("Admin login failed:", error);
			const errorMessage =
				(error as { response?: { data?: { detail?: string } } })?.response
					?.data?.detail || "Invalid credentials";
			setFormError(errorMessage);
		}
	});

	return (
		<div className="w-full max-w-md mx-auto">
			<div className="mb-6 text-center">
				<p className="text-sm text-muted-foreground">
					Admin login for administrators
				</p>
			</div>

			<Form {...form}>
				<form onSubmit={handleSubmit} className="space-y-4">
					{formError && (
						<div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3">
							<AlertCircle className="h-4 w-4 flex-shrink-0 text-destructive" />
							<p className="text-sm text-destructive">{formError}</p>
						</div>
					)}

					<FormField
						control={form.control}
						name="username"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Username</FormLabel>
								<FormControl>
									<Input
										{...field}
										type="text"
										placeholder="Enter username"
										autoComplete="username"
										disabled={isSubmitting}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="password"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Password</FormLabel>
								<div className="relative">
									<FormControl>
										<Input
											{...field}
											type={showPassword ? "text" : "password"}
											placeholder="Enter password"
											autoComplete="current-password"
											disabled={isSubmitting}
											className="pr-10"
										/>
									</FormControl>
									<button
										type="button"
										onClick={() => setShowPassword((prev) => !prev)}
										className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
										disabled={isSubmitting}
									>
										{showPassword ? (
											<EyeOff className="h-4 w-4" />
										) : (
											<Eye className="h-4 w-4" />
										)}
									</button>
								</div>
								<FormMessage />
							</FormItem>
						)}
					/>

					<div className="flex gap-3">
						<Button type="submit" className="flex-1 gap-2" disabled={isSubmitting}>
							{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
							Login
						</Button>
						<Button
							type="button"
							variant="outline"
							onClick={() => {
								form.reset();
								setFormError(null);
								onCancel();
							}}
							disabled={isSubmitting}
						>
							Back
						</Button>
					</div>
				</form>
			</Form>

			<div className="mt-4 border-t border-border/20 pt-4">
				<p className="text-center text-xs text-muted-foreground">
					Press{" "}
					<kbd className="rounded bg-muted px-1 py-0.5 text-xs">
						Ctrl+Shift+D
					</kbd>{" "}
					to return to normal login
				</p>
			</div>
		</div>
	);
}

