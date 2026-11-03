# DORA Metrics Report

**Generated:** 2026-11-03 09:03:24

## Summary

|Metric|Value|Category|
| --- | --- | --- |
| Deployment Frequency | 9.85/week | Elite |
| Lead Time for Changes | 8m 45s | Elite |
| Change Failure Rate | 0.0% | Elite |
| Time to Restore | 16h 49m | High |

**Total Runs:** 4 | **Successful:** 4 (100.0%) | **Failed:** 0 (0.0%)

---

## Visualizations

### Workflow Outcomes

```mermaid
pie title Workflow Run Outcomes
    "Success" : 4
```

### Lead Time Trend

```mermaid
xychart-beta
    title "Average Lead Time by Week"
    x-axis ["Aug 31", "Sep 07", "Sep 14", "Sep 21", "Sep 28", "Oct 05", "Oct 12", "Oct 19", "Oct 26"]
    y-axis "Duration (minutes)" 0 --> 42
    bar [9.52, 8.69, 8.27, 8.18, 8.68, 8.30, 8.47, 35.29, 8.75]
```

| Week Starting | Avg Lead Time | Deployments |
|---------------|---------------|-------------|
| Aug 31 | 9m 31s | 4 |
| Sep 07 | 8m 41s | 5 |
| Sep 14 | 8m 16s | 12 |
| Sep 21 | 8m 11s | 29 |
| Sep 28 | 8m 41s | 11 |
| Oct 05 | 8m 18s | 10 |
| Oct 12 | 8m 28s | 6 |
| Oct 19 | 35m 18s | 2 |
| Oct 26 | 8m 45s | 4 |

### Deployment Frequency Trend

```mermaid
xychart-beta
    title "Deployment Frequency Trend"
    x-axis ["Aug 31", "Sep 07", "Sep 14", "Sep 21", "Sep 28", "Oct 05", "Oct 12", "Oct 19", "Oct 26"]
    y-axis "Number of Deployments" 0 --> 34
    bar [4.00, 5.00, 12.00, 29.00, 11.00, 10.00, 6.00, 2.00, 4.00]
```

**Deployment Cadence Analysis:**
- **Average per week:** 9.2 deployments
- **Most active week:** 29 deployments
- **Least active week:** 2 deployments
- **Consistency:** Low (irregular release pattern)

### Change Failure Rate Trend

```mermaid
xychart-beta
    title "Change Failure Rate Trend"
    x-axis ["Aug 31", "Sep 07", "Sep 14", "Sep 21", "Sep 28", "Oct 05", "Oct 12", "Oct 19", "Oct 26"]
    y-axis "Failure Rate (%)" 0 --> 100
    bar [0.00, 0.00, 0.00, 8.33, 0.00, 20.00, 40.00, 33.33, 0.00]
```

| Week Starting | Total Runs | Failed | CFR |
|---------------|------------|--------|-----|
| Aug 31 | 4 | 0 | 0.0% |
| Sep 07 | 5 | 0 | 0.0% |
| Sep 14 | 12 | 0 | 0.0% |
| Sep 21 | 36 | 3 | 8.3% |
| Sep 28 | 11 | 0 | 0.0% |
| Oct 05 | 15 | 3 | 20.0% |
| Oct 12 | 10 | 4 | 40.0% |
| Oct 19 | 3 | 1 | 33.3% |
| Oct 26 | 4 | 0 | 0.0% |
**DORA Performance Tiers:**
- Elite: ≤ 15%
- High: 16-30%
- Medium: 31-45%
- Low: > 45%