import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { env } from "@/env";
import {
	ConnectionErrorPage,
	MAX_AUTO_RETURN_BOUNCES,
	getSafeRedirectTarget,
	shouldAutoReturn,
	withBounceCount,
} from "./connection-error";

const { sessionRetrieveMock } = vi.hoisted(() => ({
	sessionRetrieveMock: vi.fn(),
}));

vi.mock("@/lib/api/generated", async () => ({
	...(await vi.importActual("@/lib/api/generated")),
	authSessionRetrieve: sessionRetrieveMock,
}));

vi.mock("@/components/ModeToggle", () => ({
	ModeToggle: () => null,
}));

vi.mock("@/components/Logo", () => ({
	Logo: () => null,
}));

vi.mock("@/env", async () => {
	const actual = await vi.importActual<{ env: typeof env }>("@/env");
	return {
		...actual,
		env: { ...actual.env, VITE_SKIP_OFFLINE_CHECK: false },
	};
});

const stubNavigatorOnline = (onLine = true) =>
	vi.stubGlobal("navigator", { onLine } as Navigator);

const stubLocation = () => {
	const replace = vi.fn();
	vi.stubGlobal("location", {
		pathname: "/connection-error",
		search: "",
		hash: "",
		origin: "http://localhost:3000",
		replace,
	});
	return { replace };
};

const renderPage = (props: Parameters<typeof ConnectionErrorPage>[0] = {}) => {
	const location = stubLocation();
	stubNavigatorOnline();
	return { ...location, view: render(<ConnectionErrorPage {...props} />) };
};

const settle = async () => {
	// Executor form: tsconfig lib is ES2022, without Promise.withResolvers.
	await new Promise<void>((resolve) => setTimeout(resolve, 50));
};

beforeEach(() => {
	sessionRetrieveMock.mockReset();
	sessionRetrieveMock.mockResolvedValue({});
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("shouldAutoReturn", () => {
	it("allows silent return only for offline within the cap", () => {
		expect(shouldAutoReturn("offline", 0)).toBe(true);
		expect(shouldAutoReturn("offline", MAX_AUTO_RETURN_BOUNCES)).toBe(true);
		expect(shouldAutoReturn("offline", MAX_AUTO_RETURN_BOUNCES + 1)).toBe(
			false,
		);
	});

	it("never silently returns on server or unknown reasons", () => {
		expect(shouldAutoReturn("server", 0)).toBe(false);
		expect(shouldAutoReturn("unknown", 0)).toBe(false);
	});
});

describe("getSafeRedirectTarget", () => {
	it("falls back to / without a source", () => {
		expect(getSafeRedirectTarget(undefined)).toBe("/");
	});

	it("keeps the same-origin source untouched when no bounces", () => {
		expect(getSafeRedirectTarget("/courses?x=1#top")).toBe("/courses?x=1#top");
	});

	it("stamps the bounce count so the next failure counts up", () => {
		expect(getSafeRedirectTarget("/", 1)).toBe("/?bounces=1");
		expect(getSafeRedirectTarget("/courses?x=1", 2)).toBe(
			"/courses?x=1&bounces=2",
		);
	});

	it("rejects cross-origin and invalid sources", () => {
		expect(getSafeRedirectTarget("https://evil.example/phish", 1)).toBe("/");
		expect(getSafeRedirectTarget("http://%zz", 1)).toBe("/");
	});
});

describe("withBounceCount", () => {
	it("leaves the target untouched at zero", () => {
		expect(withBounceCount("/", 0)).toBe("/");
	});

	it("sets and overwrites the param", () => {
		expect(withBounceCount("/", 1)).toBe("/?bounces=1");
		expect(withBounceCount("/?bounces=1", 2)).toBe("/?bounces=2");
	});
});

describe("ConnectionErrorPage auto-return", () => {
	it("does not probe on mount for a server reason", async () => {
		renderPage({ reason: "server" });

		await screen.findByRole("heading", { name: "Проблема з'єднання" });
		expect(sessionRetrieveMock).not.toHaveBeenCalled();
	});

	it("probes silently on mount for offline and returns on success", async () => {
		const { replace } = renderPage({ reason: "offline", bounces: 1 });

		await waitFor(() => expect(sessionRetrieveMock).toHaveBeenCalledOnce());
		await waitFor(() => expect(replace).toHaveBeenCalledWith("/?bounces=1"));
	});

	it("returns on the browser online event, not before", async () => {
		stubLocation();
		stubNavigatorOnline(false);
		render(<ConnectionErrorPage reason="offline" />);
		await screen.findByRole("heading", { name: "Проблема з'єднання" });
		expect(sessionRetrieveMock).not.toHaveBeenCalled();

		stubNavigatorOnline(true);
		act(() => {
			globalThis.dispatchEvent(new Event("online"));
		});

		await waitFor(() => expect(sessionRetrieveMock).toHaveBeenCalledOnce());
	});

	it("ignores online events for server reasons", async () => {
		renderPage({ reason: "server" });
		await screen.findByRole("heading", { name: "Проблема з'єднання" });

		act(() => {
			globalThis.dispatchEvent(new Event("online"));
		});
		await settle();

		expect(sessionRetrieveMock).not.toHaveBeenCalled();
	});

	it("stops auto-return past the bounce cap", async () => {
		renderPage({
			reason: "offline",
			bounces: MAX_AUTO_RETURN_BOUNCES + 1,
		});
		await screen.findByRole("heading", { name: "Проблема з'єднання" });

		act(() => {
			globalThis.dispatchEvent(new Event("online"));
		});
		await settle();

		expect(sessionRetrieveMock).not.toHaveBeenCalled();
	});

	it("removes the online listener on unmount", async () => {
		const { view } = renderPage({ reason: "offline", bounces: 0 });
		await waitFor(() => expect(sessionRetrieveMock).toHaveBeenCalled());
		sessionRetrieveMock.mockClear();
		view.unmount();

		act(() => {
			globalThis.dispatchEvent(new Event("online"));
		});
		await settle();

		expect(sessionRetrieveMock).not.toHaveBeenCalled();
	});
});

describe("ConnectionErrorPage manual retry", () => {
	it("always probes on click and navigates on success", async () => {
		const { replace } = renderPage({ reason: "server", from: "/courses" });
		await screen.findByRole("heading", { name: "Проблема з'єднання" });
		expect(sessionRetrieveMock).not.toHaveBeenCalled();

		fireEvent.click(
			screen.getByRole("button", { name: "Перевірити з'єднання" }),
		);

		await waitFor(() => expect(sessionRetrieveMock).toHaveBeenCalledOnce());
		await waitFor(() => expect(replace).toHaveBeenCalledWith("/courses"));
	});

	it("shows an inline error when the probe fails", async () => {
		sessionRetrieveMock.mockRejectedValue(new Error("boom"));
		renderPage({ reason: "server" });

		fireEvent.click(
			screen.getByRole("button", { name: "Перевірити з'єднання" }),
		);

		await screen.findByRole("alert");
		expect(
			screen.getByText("Не вдалося встановити з'єднання. Спробуйте пізніше."),
		).toBeInTheDocument();
	});

	it("sends 401 probes to login with the return target", async () => {
		sessionRetrieveMock.mockRejectedValue({
			isAxiosError: true,
			response: { status: 401 },
		});
		const { replace } = renderPage({ reason: "server", from: "/courses" });

		fireEvent.click(
			screen.getByRole("button", { name: "Перевірити з'єднання" }),
		);

		await waitFor(() => expect(replace).toHaveBeenCalledOnce());
		const loginUrl = new URL(replace.mock.calls[0][0] as string);
		expect(loginUrl.pathname).toBe("/login");
		expect(loginUrl.searchParams.get("redirect")).toBe("/courses");
	});
});
