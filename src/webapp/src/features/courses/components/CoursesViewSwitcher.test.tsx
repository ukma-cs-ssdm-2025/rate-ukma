import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CoursesViewSwitcher } from "./CoursesViewSwitcher";

describe("CoursesViewSwitcher", () => {
	afterEach(() => {
		cleanup();
	});

	it("renders both view options", () => {
		const mockOnChange = vi.fn();
		const { container } = render(
			<CoursesViewSwitcher value="table" onValueChange={mockOnChange} />,
		);

		const tableButton = within(container).getByLabelText("Таблиця");
		const plotButton = within(container).getByLabelText("Графік");

		expect(tableButton).toBeInTheDocument();
		expect(plotButton).toBeInTheDocument();
	});

	it("highlights the active view", () => {
		const mockOnChange = vi.fn();
		const { container, rerender } = render(
			<CoursesViewSwitcher value="table" onValueChange={mockOnChange} />,
		);

		let tableButton = within(container).getByLabelText("Таблиця");
		expect(tableButton).toHaveAttribute("data-state", "on");

		rerender(<CoursesViewSwitcher value="plot" onValueChange={mockOnChange} />);

		const plotButton = within(container).getByLabelText("Графік");
		expect(plotButton).toHaveAttribute("data-state", "on");
	});

	it("calls onValueChange when switching views", async () => {
		const user = userEvent.setup();
		const mockOnChange = vi.fn();
		const { container } = render(
			<CoursesViewSwitcher value="table" onValueChange={mockOnChange} />,
		);

		const plotButton = within(container).getByLabelText("Графік");
		await user.click(plotButton);

		expect(mockOnChange).toHaveBeenCalledWith("plot");
	});

	it("renders icons for both views", () => {
		const mockOnChange = vi.fn();
		const { container } = render(
			<CoursesViewSwitcher value="table" onValueChange={mockOnChange} />,
		);

		// Check for lucide-react icons
		const icons = container.querySelectorAll("svg");
		expect(icons.length).toBeGreaterThanOrEqual(2);
	});

	it("applies responsive classes", () => {
		const mockOnChange = vi.fn();
		const { container } = render(
			<CoursesViewSwitcher value="table" onValueChange={mockOnChange} />,
		);

		const toggleGroup = container.querySelector("[data-slot='toggle-group']");
		expect(toggleGroup).toHaveClass("w-full");
		expect(toggleGroup?.className).toContain("sm:w-auto");
	});

	it("uses outline variant", () => {
		const mockOnChange = vi.fn();
		const { container } = render(
			<CoursesViewSwitcher value="table" onValueChange={mockOnChange} />,
		);

		const toggleGroup = container.querySelector("[data-slot='toggle-group']");
		expect(toggleGroup).toHaveAttribute("data-variant", "outline");
	});
});
