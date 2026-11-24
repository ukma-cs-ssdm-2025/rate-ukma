# DORA Metrics Report

**Generated:** 2026-11-24 09:03:34

## Summary

|Metric|Value|Category|
| --- | --- | --- |
| Deployment Frequency | 71.00/week | Elite |
| Lead Time for Changes | 10m 20s | Elite |
| Change Failure Rate | 1.7% | Elite |
| Time to Restore | 26m 27s | Elite |

**Total Runs:** 70 | **Successful:** 59 (84.3%) | **Failed:** 1 (1.4%) | **Other:** 10 (14.3%)

---

## Visualizations

### Workflow Outcomes

```mermaid
pie title Workflow Run Outcomes
    "Success" : 59
    "Failure" : 1
    "Other" : 10
```

### Lead Time Trend

```mermaid
xychart-beta
    title "Average Lead Time by Week"
    x-axis ["Nov 02", "Nov 09", "Nov 16", "Nov 23"]
    y-axis "Duration (minutes)" 0 --> 12
    bar [4.34, 7.82, 10.33, 9.30]
```

| Week Starting | Avg Lead Time | Deployments |
|---------------|---------------|-------------|
| Nov 02 | 4m 20s | 2 |
| Nov 09 | 7m 49s | 20 |
| Nov 16 | 10m 20s | 60 |
| Nov 23 | 9m 18s | 5 |

### Deployment Frequency Trend

```mermaid
xychart-beta
    title "Deployment Frequency Trend"
    x-axis ["Nov 02", "Nov 09", "Nov 16", "Nov 23"]
    y-axis "Number of Deployments" 0 --> 72
    bar [2.00, 20.00, 60.00, 5.00]
```

**Deployment Cadence Analysis:**
- **Average per week:** 21.8 deployments
- **Most active week:** 60 deployments
- **Least active week:** 2 deployments
- **Consistency:** Low (irregular release pattern)

### Change Failure Rate Trend

```mermaid
xychart-beta
    title "Change Failure Rate Trend"
    x-axis ["Nov 02", "Nov 09", "Nov 16", "Nov 23"]
    y-axis "Failure Rate (%)" 0 --> 100
    bar [0.00, 9.09, 1.41, 0.00]
```

| Week Starting | Total Runs | Failed | CFR |
|---------------|------------|--------|-----|
| Nov 02 | 2 | 0 | 0.0% |
| Nov 09 | 22 | 2 | 9.1% |
| Nov 16 | 71 | 1 | 1.4% |
| Nov 23 | 5 | 0 | 0.0% |
**DORA Performance Tiers:**
- Elite: ≤ 15%
- High: 16-30%
- Medium: 31-45%
- Low: > 45%