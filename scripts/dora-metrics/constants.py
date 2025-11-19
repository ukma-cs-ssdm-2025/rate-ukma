"""Constants for DORA metrics calculation and reporting."""

# Workflow run status and conclusions
STATUS_COMPLETED = "completed"
CONCLUSION_SUCCESS = "success"
CONCLUSION_FAILURE = "failure"

# Time conversion constants
SECONDS_PER_MINUTE = 60
MINUTES_PER_HOUR = 60
HOURS_PER_DAY = 24
MINUTES_PER_DAY = MINUTES_PER_HOUR * HOURS_PER_DAY  # 1440
SECONDS_PER_DAY = SECONDS_PER_MINUTE * MINUTES_PER_HOUR * HOURS_PER_DAY  # 86400

# Chart configuration
CHART_Y_AXIS_PADDING = 1.2  # Add 20% padding to max value for better visualization

# Deployment consistency thresholds (based on standard deviation relative to mean)
CONSISTENCY_HIGH_THRESHOLD = 0.3  # Low variance = high consistency
CONSISTENCY_MEDIUM_THRESHOLD = 0.6  # Medium variance = medium consistency
# Above 0.6 = low consistency

# DORA performance tier thresholds

# Deployment Frequency (deployments per week)
DEPLOYMENT_FREQ_ELITE = 7.0  # Multiple deploys per day (>= 1/day)
DEPLOYMENT_FREQ_HIGH = 1.0  # Between once per week and once per month
DEPLOYMENT_FREQ_MEDIUM = 0.25  # Between once per month and once per 6 months

# Lead Time for Changes (minutes)
LEAD_TIME_ELITE = 60  # Less than one hour
LEAD_TIME_HIGH = 1440  # Between one day and one week (1 day)
LEAD_TIME_MEDIUM = 43200  # Between one week and one month (30 days)

# Change Failure Rate (percentage)
CHANGE_FAILURE_RATE_ELITE = 15.0  # 0-15%
CHANGE_FAILURE_RATE_HIGH = 30.0  # 16-30%
CHANGE_FAILURE_RATE_MEDIUM = 45.0  # 31-45%

TIME_TO_RESTORE_ELITE = 60  # Less than one hour
TIME_TO_RESTORE_HIGH = 1440  # Less than one day
TIME_TO_RESTORE_MEDIUM = 10080  # Less than one week (7 days)
