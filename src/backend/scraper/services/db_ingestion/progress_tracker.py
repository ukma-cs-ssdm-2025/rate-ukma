import structlog

logger = structlog.get_logger(__name__)


class InjectionProgressTracker:
    LOG_INTERVAL = 5

    def __init__(self):
        self.total_courses = 0
        self.processed_courses = 0

    def start(self, total: int) -> None:
        self.total_courses = total
        logger.info("starting_injection", total_courses=total)

    def increment(self) -> None:
        self.processed_courses += 1
        if self.total_courses == 0:
            logger.error("total_courses_not_set", total_courses=self.total_courses)
            return

        if self.processed_courses % self.LOG_INTERVAL == 0:
            percentage = f"{(self.processed_courses / self.total_courses) * 100:.1f}%"
            logger.info(
                "injection_progress",
                processed=self.processed_courses,
                total=self.total_courses,
                percentage=percentage,
            )

    def complete(self, message: str) -> None:
        logger.info("injection_completed", message=message, total_processed=self.processed_courses)
        self.reset()

    def fail(self, error: str) -> None:
        logger.error(
            "injection_failed", error=error, processed_before_failure=self.processed_courses
        )
        self.reset()

    def reset(self) -> None:
        self.total_courses = 0
        self.processed_courses = 0
