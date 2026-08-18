# DORA Metrics Report

**Generated:** 2026-08-18 09:08:50

## Summary

|Metric|Value|Category|
| --- | --- | --- |
| Deployment Frequency | 49.00/week | Elite |
| Lead Time for Changes | 8m 42s | Elite |
| Change Failure Rate | 22.2% | High |
| Time to Restore | 2h 20m | High |

**Total Runs:** 9 | **Successful:** 7 (77.8%) | **Failed:** 2 (22.2%)

---

## Visualizations

### Workflow Outcomes

```mermaid
pie title Workflow Run Outcomes
    "Success" : 7
    "Failure" : 2
```

### Lead Time Trend

```mermaid
xychart-beta
    title "Average Lead Time by Week"
    x-axis ["Apr 20", "Apr 27", "May 11", "May 18", "May 25", "Jun 01", "Jun 08", "Jun 15", "Jun 22", "Jun 29", "Jul 06", "Jul 20", "Aug 03", "Aug 10"]
    y-axis "Duration (minutes)" 0 --> 13
    bar [7.94, 7.58, 7.84, 7.57, 10.99, 3.80, 6.97, 7.72, 7.67, 7.87, 7.66, 7.90, 8.04, 8.70]
```

| Week Starting | Avg Lead Time | Deployments |
|---------------|---------------|-------------|
| Apr 20 | 7m 56s | 2 |
| Apr 27 | 7m 34s | 6 |
| May 11 | 7m 51s | 19 |
| May 18 | 7m 34s | 10 |
| May 25 | 10m 59s | 5 |
| Jun 01 | 3m 48s | 2 |
| Jun 08 | 6m 58s | 4 |
| Jun 15 | 7m 44s | 2 |
| Jun 22 | 7m 40s | 4 |
| Jun 29 | 7m 52s | 2 |
| Jul 06 | 7m 39s | 3 |
| Jul 20 | 7m 54s | 1 |
| Aug 03 | 8m 2s | 2 |
| Aug 10 | 8m 42s | 7 |

### Deployment Frequency Trend

```mermaid
xychart-beta
    title "Deployment Frequency Trend"
    x-axis ["Apr 20", "Apr 27", "May 11", "May 18", "May 25", "Jun 01", "Jun 08", "Jun 15", "Jun 22", "Jun 29", "Jul 06", "Jul 20", "Aug 03", "Aug 10"]
    y-axis "Number of Deployments" 0 --> 22
    bar [2.00, 6.00, 19.00, 10.00, 5.00, 2.00, 4.00, 2.00, 4.00, 2.00, 3.00, 1.00, 2.00, 7.00]
```

**Deployment Cadence Analysis:**
- **Average per week:** 4.9 deployments
- **Most active week:** 19 deployments
- **Least active week:** 1 deployments
- **Consistency:** Low (irregular release pattern)

### Change Failure Rate Trend

```mermaid
xychart-beta
    title "Change Failure Rate Trend"
    x-axis ["Apr 20", "Apr 27", "May 11", "May 18", "May 25", "Jun 01", "Jun 08", "Jun 15", "Jun 22", "Jun 29", "Jul 06", "Jul 20", "Aug 03", "Aug 10"]
    y-axis "Failure Rate (%)" 0 --> 100
    bar [0.00, 0.00, 25.00, 20.00, 0.00, 0.00, 20.00, 33.33, 33.33, 0.00, 0.00, 0.00, 0.00, 22.22]
```

| Week Starting | Total Runs | Failed | CFR |
|---------------|------------|--------|-----|
| Apr 20 | 2 | 0 | 0.0% |
| Apr 27 | 9 | 0 | 0.0% |
| May 11 | 36 | 9 | 25.0% |
| May 18 | 15 | 3 | 20.0% |
| May 25 | 5 | 0 | 0.0% |
| Jun 01 | 2 | 0 | 0.0% |
| Jun 08 | 5 | 1 | 20.0% |
| Jun 15 | 3 | 1 | 33.3% |
| Jun 22 | 6 | 2 | 33.3% |
| Jun 29 | 2 | 0 | 0.0% |
| Jul 06 | 3 | 0 | 0.0% |
| Jul 20 | 1 | 0 | 0.0% |
| Aug 03 | 2 | 0 | 0.0% |
| Aug 10 | 9 | 2 | 22.2% |
**DORA Performance Tiers:**
- Elite: ≤ 15%
- High: 16-30%
- Medium: 31-45%
- Low: > 45%