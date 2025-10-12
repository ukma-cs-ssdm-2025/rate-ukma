import structlog

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json_formatter": {
            "()": structlog.stdlib.ProcessorFormatter,
            "processor": structlog.processors.JSONRenderer(),
        },
        "plain_console": {
            "()": structlog.stdlib.ProcessorFormatter,
            "processor": structlog.dev.ConsoleRenderer(),
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "plain_console",
        },
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "INFO",
        },
        "rating_app": {
            "handlers": ["console"],
            "level": "DEBUG",
            "propagate": True,
        },
    },
}


def align_event_name(logger, method_name, event_dict):
    event = event_dict.get("event", "")
    MAX_LENGTH = 45
    if len(event) < MAX_LENGTH:
        event_dict["event"] = event.ljust(MAX_LENGTH)
    return event_dict


def format_event_name(logger, method_name, event_dict):
    logger_name = logger.name if logger.name else "default"
    module_name = logger_name.split(".")[-1]
    if "event" in event_dict:
        event = event_dict["event"]
        event_dict["event"] = f"{module_name}.{event}"
    return event_dict


current_processors = structlog.get_config().get("processors", [])
updated_processors = [
    format_event_name,
    align_event_name,
] + current_processors

structlog.configure(
    processors=updated_processors,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)
