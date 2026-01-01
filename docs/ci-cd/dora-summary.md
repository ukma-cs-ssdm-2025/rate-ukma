# DORA Metrics Report

**Generated:** 2025-12-30 09:05:09

## Summary

|Metric|Value|Category|
| --- | --- | --- |
| Deployment Frequency | 12.52/week | Elite |
| Lead Time for Changes | 6m 38s | Elite |
| Change Failure Rate | 0.0% | Elite |
| Time to Restore | 3h 47m | High |

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
    x-axis ["Nov 10", "Nov 17", "Nov 24", "Dec 01", "Dec 08", "Dec 15", "Dec 22"]
    y-axis "Duration (minutes)" 0 --> 10
    bar [2.39, 5.27, 8.71, 4.08, 7.87, 6.60, 6.62]
```

| Week Starting | Avg Lead Time | Deployments |
|---------------|---------------|-------------|
| Nov 10 | 2m 24s | 2 |
| Nov 17 | 5m 16s | 14 |
| Nov 24 | 8m 43s | 9 |
| Dec 01 | 4m 5s | 31 |
| Dec 08 | 7m 52s | 11 |
| Dec 15 | 6m 36s | 1 |
| Dec 22 | 6m 38s | 4 |

### Deployment Frequency Trend

```mermaid
xychart-beta
    title "Deployment Frequency Trend"
    x-axis ["Nov 10", "Nov 17", "Nov 24", "Dec 01", "Dec 08", "Dec 15", "Dec 22"]
    y-axis "Number of Deployments" 0 --> 37
    bar [2.00, 14.00, 9.00, 31.00, 11.00, 1.00, 4.00]
```

**Deployment Cadence Analysis:**
- **Average per week:** 10.3 deployments
- **Most active week:** 31 deployments
- **Least active week:** 1 deployments
- **Consistency:** Low (irregular release pattern)

### Change Failure Rate Trend

```mermaid
xychart-beta
    title "Change Failure Rate Trend"
    x-axis ["Nov 10", "Nov 17", "Nov 24", "Dec 01", "Dec 08", "Dec 15", "Dec 22"]
    y-axis "Failure Rate (%)" 0 --> 100
    bar [0.00, 16.67, 25.00, 20.83, 20.00, 0.00, 0.00]
```

| Week Starting | Total Runs | Failed | CFR |
|---------------|------------|--------|-----|
| Nov 10 | 2 | 0 | 0.0% |
| Nov 17 | 18 | 3 | 16.7% |
| Nov 24 | 12 | 3 | 25.0% |
| Dec 01 | 48 | 10 | 20.8% |
| Dec 08 | 15 | 3 | 20.0% |
| Dec 15 | 1 | 0 | 0.0% |
| Dec 22 | 4 | 0 | 0.0% |
**DORA Performance Tiers:**
- Elite: ≤ 15%
- High: 16-30%
- Medium: 31-45%
- Low: > 45%