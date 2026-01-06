# DORA Metrics Report

**Generated:** 2026-01-06 09:05:38

## Summary

|Metric|Value|Category|
| --- | --- | --- |
| Deployment Frequency | 14.59/week | Elite |
| Lead Time for Changes | 5m 20s | Elite |
| Change Failure Rate | 16.7% | High |
| Time to Restore | 3h 50m | High |

**Total Runs:** 6 | **Successful:** 5 (83.3%) | **Failed:** 1 (16.7%)

---

## Visualizations

### Workflow Outcomes

```mermaid
pie title Workflow Run Outcomes
    "Success" : 5
    "Failure" : 1
```

### Lead Time Trend

```mermaid
xychart-beta
    title "Average Lead Time by Week"
    x-axis ["Nov 17", "Nov 24", "Dec 01", "Dec 08", "Dec 15", "Dec 22", "Dec 29"]
    y-axis "Duration (minutes)" 0 --> 10
    bar [5.53, 8.71, 4.08, 7.87, 6.60, 6.62, 5.33]
```

| Week Starting | Avg Lead Time | Deployments |
|---------------|---------------|-------------|
| Nov 17 | 5m 32s | 12 |
| Nov 24 | 8m 43s | 9 |
| Dec 01 | 4m 5s | 31 |
| Dec 08 | 7m 52s | 11 |
| Dec 15 | 6m 36s | 1 |
| Dec 22 | 6m 38s | 4 |
| Dec 29 | 5m 20s | 5 |

### Deployment Frequency Trend

```mermaid
xychart-beta
    title "Deployment Frequency Trend"
    x-axis ["Nov 17", "Nov 24", "Dec 01", "Dec 08", "Dec 15", "Dec 22", "Dec 29"]
    y-axis "Number of Deployments" 0 --> 37
    bar [12.00, 9.00, 31.00, 11.00, 1.00, 4.00, 5.00]
```

**Deployment Cadence Analysis:**
- **Average per week:** 10.4 deployments
- **Most active week:** 31 deployments
- **Least active week:** 1 deployments
- **Consistency:** Low (irregular release pattern)

### Change Failure Rate Trend

```mermaid
xychart-beta
    title "Change Failure Rate Trend"
    x-axis ["Nov 17", "Nov 24", "Dec 01", "Dec 08", "Dec 15", "Dec 22", "Dec 29"]
    y-axis "Failure Rate (%)" 0 --> 100
    bar [14.29, 25.00, 20.83, 20.00, 0.00, 0.00, 16.67]
```

| Week Starting | Total Runs | Failed | CFR |
|---------------|------------|--------|-----|
| Nov 17 | 14 | 2 | 14.3% |
| Nov 24 | 12 | 3 | 25.0% |
| Dec 01 | 48 | 10 | 20.8% |
| Dec 08 | 15 | 3 | 20.0% |
| Dec 15 | 1 | 0 | 0.0% |
| Dec 22 | 4 | 0 | 0.0% |
| Dec 29 | 6 | 1 | 16.7% |
**DORA Performance Tiers:**
- Elite: ≤ 15%
- High: 16-30%
- Medium: 31-45%
- Low: > 45%