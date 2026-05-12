from typing import overload
import re


class CommentNormalizer:
    @overload
    def normalize_comment(self, comment: str) -> str: ...

    @overload
    def normalize_comment(self, comment: None) -> None: ...

    def normalize_comment(self, comment: str | None) -> str | None:
        if comment is None or comment == "":
            return comment

        comment = comment.replace("\r\n", "\n").replace("\r", "\n")
        comment = re.sub(r"\n{4,}", "\n\n\n", comment)

        lines = [line.rstrip() for line in comment.split("\n")]
        return "\n".join(lines).strip()
