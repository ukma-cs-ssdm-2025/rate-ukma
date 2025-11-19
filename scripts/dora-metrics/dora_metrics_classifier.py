def classify_deployment_frequency(weekly_df: float) -> str:
    if weekly_df >= 7:  # daily or more
        return "Elite"
    elif weekly_df >= 1:  # weekly
        return "High"
    elif weekly_df >= 0.25:  # monthly (1/4 per week)
        return "Medium"
    else:
        return "Low"


def classify_lead_time(minutes: float) -> str:
    if minutes <= 60:  # <= 1 hour
        return "Elite"
    elif minutes <= 1440:  # <= 1 day
        return "High"
    elif minutes <= 10080:  # <= 1 week
        return "Medium"
    else:
        return "Low"


def classify_change_failure_rate(rate: float) -> str:
    if rate <= 15:
        return "Elite"
    elif rate <= 30:
        return "High"
    elif rate <= 45:
        return "Medium"
    else:
        return "Low"


def classify_time_to_restore(minutes: float) -> str:
    if minutes <= 60:  # <= 1 hour
        return "Elite"
    elif minutes <= 1440:  # <= 1 day
        return "High"
    elif minutes <= 10080:  # <= 1 week
        return "Medium"
    else:
        return "Low"
