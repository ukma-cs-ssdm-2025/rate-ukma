import { useMemo, useState } from "react";

import type { Column } from "@tanstack/react-table";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CourseColumnHeader } from "./CourseColumnHeader";

type SortState = false | "asc" | "desc";

function Harness({
	initialSortDirection,
	canSort,
	onToggleSorting,
	onClearSorting,
}: Readonly<{
	initialSortDirection: "asc" | "desc";
	canSort: boolean;
	onToggleSorting: (desc: boolean, isMulti: boolean) => void;
	onClearSorting: () => void;
}>) {
	const [sortState, setSortState] = useState<SortState>(false);

	const column = useMemo(() => {
		return {
			getCanSort: () => canSort,
			getIsSorted: () => sortState,
			toggleSorting: (desc: boolean, isMulti: boolean) => {
				onToggleSorting(desc, isMulti);
				setSortState(desc ? "desc" : "asc");
			},
			clearSorting: () => {
				onClearSorting();
				setSortState(false);
			},
		} as unknown as Column<unknown, unknown>;
	}, [canSort, onClearSorting, onToggleSorting, sortState]);

	return (
		<CourseColumnHeader
			column={column}
			title="Складність"
			initialSortDirection={initialSortDirection}
			testId="sort-button"
		/>
	);
}

describe("CourseColumnHeader", () => {
	it("cycles sorting for initial direction 'asc': unsorted → asc → desc → cleared", async () => {
		const user = userEvent.setup();
		const toggleSorting = vi.fn();
		const clearSorting = vi.fn();

		render(
			<Harness
				initialSortDirection="asc"
				canSort={true}
				onToggleSorting={toggleSorting}
				onClearSorting={clearSorting}
			/>,
		);

		const button = screen.getByTestId("sort-button");
		expect(button).toHaveAttribute("aria-label", "Сортувати за зростанням");

		await user.click(button);
		expect(toggleSorting).toHaveBeenCalledWith(false, false);
		expect(button).toHaveAttribute("aria-label", "Сортувати за спаданням");

		await user.click(button);
		expect(toggleSorting).toHaveBeenCalledWith(true, false);
		expect(button).toHaveAttribute("aria-label", "Скинути сортування");

		await user.click(button);
		expect(clearSorting).toHaveBeenCalledTimes(1);
		expect(button).toHaveAttribute("aria-label", "Сортувати за зростанням");
	});

	it("cycles sorting for initial direction 'desc': unsorted → desc → asc → cleared", async () => {
		const user = userEvent.setup();
		const toggleSorting = vi.fn();
		const clearSorting = vi.fn();

		render(
			<Harness
				initialSortDirection="desc"
				canSort={true}
				onToggleSorting={toggleSorting}
				onClearSorting={clearSorting}
			/>,
		);

		const button = screen.getByTestId("sort-button");
		expect(button).toHaveAttribute("aria-label", "Сортувати за спаданням");

		await user.click(button);
		expect(toggleSorting).toHaveBeenCalledWith(true, false);
		expect(button).toHaveAttribute("aria-label", "Сортувати за зростанням");

		await user.click(button);
		expect(toggleSorting).toHaveBeenCalledWith(false, false);
		expect(button).toHaveAttribute("aria-label", "Скинути сортування");

		await user.click(button);
		expect(clearSorting).toHaveBeenCalledTimes(1);
		expect(button).toHaveAttribute("aria-label", "Сортувати за спаданням");
	});

	it("supports multi-sort click with shiftKey", async () => {
		const user = userEvent.setup();
		const toggleSorting = vi.fn();
		const clearSorting = vi.fn();

		render(
			<Harness
				initialSortDirection="asc"
				canSort={true}
				onToggleSorting={toggleSorting}
				onClearSorting={clearSorting}
			/>,
		);

		const button = screen.getByTestId("sort-button");
		await user.keyboard("{Shift>}");
		await user.click(button);
		await user.keyboard("{/Shift}");

		expect(toggleSorting).toHaveBeenCalledWith(false, true);
		expect(clearSorting).not.toHaveBeenCalled();
	});

	it("disables sorting when column cannot sort", async () => {
		const user = userEvent.setup();
		const toggleSorting = vi.fn();
		const clearSorting = vi.fn();

		render(
			<Harness
				initialSortDirection="asc"
				canSort={false}
				onToggleSorting={toggleSorting}
				onClearSorting={clearSorting}
			/>,
		);

		const button = screen.getByTestId("sort-button");
		expect(button).toBeDisabled();

		await user.click(button);
		expect(toggleSorting).not.toHaveBeenCalled();
		expect(clearSorting).not.toHaveBeenCalled();
	});
});
