"""Fluent builder for Mermaid charts."""

from typing import Optional


class MermaidChartBuilder:
    def __init__(self, chart_type: str = "xychart-beta"):
        self.chart_type = chart_type
        self.title_text = ""
        self.x_labels: list[str] = []
        self.y_label = ""
        self.y_min: float = 0
        self.y_max: Optional[float] = None
        self.data_values: list[float] = []

    def title(self, text: str) -> "MermaidChartBuilder":
        self.title_text = text
        return self

    def x_axis(self, labels: list[str]) -> "MermaidChartBuilder":
        self.x_labels = labels
        return self

    def y_axis(
        self, label: str, min_val: float = 0, max_val: Optional[float] = None
    ) -> "MermaidChartBuilder":
        self.y_label = label
        self.y_min = min_val
        self.y_max = max_val
        return self

    def bar_data(self, values: list[float]) -> "MermaidChartBuilder":
        self.data_values = values
        return self

    def build(self) -> str:
        lines = ["```mermaid", self.chart_type]

        if self.title_text:
            lines.append(f'    title "{self.title_text}"')

        if self.x_labels:
            labels_str = ", ".join(f'"{label}"' for label in self.x_labels)
            lines.append(f"    x-axis [{labels_str}]")

        if self.y_label:
            y_max = self.y_max if self.y_max is not None else 100
            lines.append(f'    y-axis "{self.y_label}" {self.y_min} --> {int(y_max)}')

        if self.data_values:
            values_str = ", ".join(f"{val:.2f}" for val in self.data_values)
            lines.append(f"    bar [{values_str}]")

        lines.append("```")
        return "\n".join(lines)


class PieChartBuilder:
    def __init__(self):
        self.title_text = ""
        self.slices: list[tuple[str, int]] = []

    def title(self, text: str) -> "PieChartBuilder":
        self.title_text = text
        return self

    def add_slice(self, label: str, value: int) -> "PieChartBuilder":
        if value > 0:  # Only add non-zero slices
            self.slices.append((label, value))
        return self

    def build(self) -> str:
        lines = ["```mermaid"]

        if self.title_text:
            lines.append(f"pie title {self.title_text}")
        else:
            lines.append("pie")

        for label, value in self.slices:
            lines.append(f'    "{label}" : {value}')

        lines.append("```")
        return "\n".join(lines)
