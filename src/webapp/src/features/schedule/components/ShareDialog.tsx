import { Check, Copy, Link2, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import {
	copyTextSilent,
	toastCopyFailed,
} from "@/features/schedule/lib/clipboard";
import {
	createShareLink,
	revokeShareLink,
	rotateShareLink,
	shareUrlOf,
} from "@/features/schedule/lib/share";

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	semester: string | undefined;
	canShare: boolean;
}

/**
 * The read-only link for one semester's plan: copy it, mint a fresh one, or
 * drop it. Link holders see the timetable but cannot edit it.
 */
export function ShareDialog(props: Props) {
	const [linkCopied, setLinkCopied] = useState(false);
	const linkTimer = useRef<number | undefined>(undefined);
	useEffect(() => () => window.clearTimeout(linkTimer.current), []);
	const copyLink = async (link: string) => {
		if (await copyTextSilent(link)) {
			setLinkCopied(true);
			window.clearTimeout(linkTimer.current);
			linkTimer.current = window.setTimeout(() => setLinkCopied(false), 1600);
		} else {
			toastCopyFailed();
		}
	};
	const { open, onOpenChange, semester, canShare } = props;
	const [token, setToken] = useState<string | undefined>(undefined);
	const [busy, setBusy] = useState(false);
	const failed = (cause: unknown): void => {
		toast.error(cause instanceof Error ? cause.message : "Не вдалося");
	};

	const create = async () => {
		if (!canShare || busy) return;
		setBusy(true);
		try {
			setToken(await createShareLink(semester));
		} catch (error) {
			failed(error);
		} finally {
			setBusy(false);
		}
	};

	// Mint on first open; the dialog content below reads the token.
	const opened = useRef(false);
	useEffect(() => {
		if (!open || opened.current || token !== undefined) return;
		opened.current = true;
		void create();
		// Create once per mount; reopening after revoke offers the button.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	const rotate = async () => {
		if (busy) return;
		setBusy(true);
		try {
			setToken(await rotateShareLink(semester));
			toast.success("Посилання оновлено");
		} catch (error) {
			failed(error);
		} finally {
			setBusy(false);
		}
	};

	// Revoking cannot be taken back (a new link is a different link), so the
	// button asks once more on itself instead of acting on the first press.
	const [confirming, setConfirming] = useState(false);
	const confirmTimer = useRef<number | undefined>(undefined);
	useEffect(() => () => window.clearTimeout(confirmTimer.current), []);
	const revoke = async () => {
		if (busy) return;
		if (!confirming) {
			setConfirming(true);
			window.clearTimeout(confirmTimer.current);
			confirmTimer.current = window.setTimeout(
				() => setConfirming(false),
				4000,
			);
			return;
		}
		window.clearTimeout(confirmTimer.current);
		setConfirming(false);
		setBusy(true);
		try {
			await revokeShareLink(semester);
			setToken(undefined);
			toast.success("Доступ скасовано");
		} catch (error) {
			failed(error);
		} finally {
			setBusy(false);
		}
	};

	const link = token === undefined ? "" : shareUrlOf(token);
	// The first open mints the link at once: show the dialog it will become,
	// not the «no link yet» offer it replaces a moment later.
	const creating = busy && token === undefined;
	const offer = token === undefined && !creating;

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) setBusy(false);
				onOpenChange(next);
			}}
		>
			<DialogContent data-testid="share-dialog" className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Поділитися розкладом</DialogTitle>
					<DialogDescription>
						Хто має посилання, бачить розклад, але не може його змінити.
					</DialogDescription>
				</DialogHeader>
				{offer ? (
					<p
						className="text-xs leading-relaxed text-muted-foreground"
						data-testid="share-empty"
					>
						{canShare
							? "Посилання ще немає. Створи його, щоб показати розклад."
							: "Додай дисципліни в план, щоб було чим ділитися."}
					</p>
				) : (
					// The link is the point: copying it is the one primary action and
					// sits on the field it copies.
					<div className="flex min-w-0 gap-2 max-sm:flex-col">
						{creating ? (
							<Skeleton
								role="status"
								aria-label="Створюємо посилання…"
								className="h-9 w-full md:h-7"
							/>
						) : (
							<Input
								readOnly
								name="share-link"
								autoComplete="off"
								spellCheck={false}
								value={link}
								aria-label="Посилання на розклад"
								data-testid="share-link"
								onFocus={(event) => event.target.select()}
							/>
						)}
						<Button
							size="compact"
							data-testid="share-copy"
							disabled={creating}
							onClick={() => void copyLink(link)}
							className="shrink-0"
						>
							{linkCopied ? <Check /> : <Copy />}
							{linkCopied ? "Скопійовано" : "Копіювати"}
						</Button>
					</div>
				)}
				<DialogFooter className={offer ? "" : "sm:justify-between"}>
					{offer ? (
						<Button
							size="compact"
							data-testid="share-create"
							disabled={!canShare || busy}
							onClick={() => void create()}
						>
							<Link2 /> Створити посилання
						</Button>
					) : (
						<>
							<Button
								size="compact"
								variant="destructive"
								data-testid="share-revoke"
								disabled={busy}
								onClick={() => void revoke()}
								onBlur={() => setConfirming(false)}
							>
								{confirming ? "Так, скасувати доступ" : "Скасувати доступ"}
							</Button>
							<Button
								size="compact"
								variant="outline"
								data-testid="share-rotate"
								disabled={busy}
								onClick={() => void rotate()}
							>
								<RefreshCw /> Нове посилання
							</Button>
						</>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
