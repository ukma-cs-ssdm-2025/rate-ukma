"""DORA metrics classification functions."""

from constants import (
    CHANGE_FAILURE_RATE_ELITE,
    CHANGE_FAILURE_RATE_HIGH,
    CHANGE_FAILURE_RATE_MEDIUM,
    DEPLOYMENT_FREQ_ELITE,
    DEPLOYMENT_FREQ_HIGH,
    DEPLOYMENT_FREQ_MEDIUM,
    LEAD_TIME_ELITE,
    LEAD_TIME_HIGH,
    LEAD_TIME_MEDIUM,
    TIME_TO_RESTORE_ELITE,
    TIME_TO_RESTORE_HIGH,
    TIME_TO_RESTORE_MEDIUM,
)


def classify_deployment_frequency(weekly_df: float) -> str:
    """Classify deployment frequency into DORA performance tiers."""
    if weekly_df >= DEPLOYMENT_FREQ_ELITE:
        return "Elite"
    elif weekly_df >= DEPLOYMENT_FREQ_HIGH:
        return "High"
    elif weekly_df >= DEPLOYMENT_FREQ_MEDIUM:
        return "Medium"
    else:
        return "Low"


def classify_lead_time(minutes: float) -> str:
    """Classify lead time into DORA performance tiers."""
    if minutes <= LEAD_TIME_ELITE:
        return "Elite"
    elif minutes <= LEAD_TIME_HIGH:
        return "High"
    elif minutes <= LEAD_TIME_MEDIUM:
        return "Medium"
    else:
        return "Low"


def classify_change_failure_rate(rate: float) -> str:
    """Classify change failure rate into DORA performance tiers."""
    if rate <= CHANGE_FAILURE_RATE_ELITE:
        return "Elite"
    elif rate <= CHANGE_FAILURE_RATE_HIGH:
        return "High"
    elif rate <= CHANGE_FAILURE_RATE_MEDIUM:
        return "Medium"
    else:
        return "Low"


def classify_time_to_restore(minutes: float) -> str:
    """Classify time to restore into DORA performance tiers."""
    if minutes <= TIME_TO_RESTORE_ELITE:
        return "Elite"
    elif minutes <= TIME_TO_RESTORE_HIGH:
        return "High"
    elif minutes <= TIME_TO_RESTORE_MEDIUM:
        return "Medium"
    else:
        return "Low"
