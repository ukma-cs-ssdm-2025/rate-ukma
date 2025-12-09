# DORA Metrics Report

**Generated:** 2025-12-09 09:04:39

## Summary

|Metric|Value|Category|
| --- | --- | --- |
| Deployment Frequency | 40.35/week | Elite |
| Lead Time for Changes | 4m 52s | Elite |
| Change Failure Rate | 26.5% | High |
| Time to Restore | 3h 37m | High |

**Total Runs:** 56 | **Successful:** 36 (64.3%) | **Failed:** 13 (23.2%) | **Other:** 7 (12.5%)

---

## Visualizations

### Workflow Outcomes

```mermaid
pie title Workflow Run Outcomes
    "Success" : 36
    "Failure" : 13
    "Other" : 7
```

### Lead Time Trend

```mermaid
xychart-beta
    title "Average Lead Time by Week"
    x-axis ["Nov 10", "Nov 17", "Nov 24", "Dec 01", "Dec 08"]
    y-axis "Duration (minutes)" 0 --> 10
    bar [2.04, 5.27, 8.71, 4.08, 7.42]
```

| Week Starting | Avg Lead Time | Deployments |
|---------------|---------------|-------------|
| Nov 10 | 2m 3s | 9 |
| Nov 17 | 5m 16s | 14 |
| Nov 24 | 8m 43s | 9 |
| Dec 01 | 4m 5s | 31 |
| Dec 08 | 7m 26s | 8 |

### Deployment Frequency Trend

```mermaid
xychart-beta
    title "Deployment Frequency Trend"
    x-axis ["Nov 10", "Nov 17", "Nov 24", "Dec 01", "Dec 08"]
    y-axis "Number of Deployments" 0 --> 37
    bar [9.00, 14.00, 9.00, 31.00, 8.00]
```

**Deployment Cadence Analysis:**
- **Average per week:** 14.2 deployments
- **Most active week:** 31 deployments
- **Least active week:** 8 deployments
- **Consistency:** Low (irregular release pattern)

### Change Failure Rate Trend

```mermaid
xychart-beta
    title "Change Failure Rate Trend"
    x-axis ["Nov 10", "Nov 17", "Nov 24", "Dec 01", "Dec 08"]
    y-axis "Failure Rate (%)" 0 --> 100
    bar [9.09, 16.67, 25.00, 20.83, 27.27]
```

| Week Starting | Total Runs | Failed | CFR |
|---------------|------------|--------|-----|
| Nov 10 | 11 | 1 | 9.1% |
| Nov 17 | 18 | 3 | 16.7% |
| Nov 24 | 12 | 3 | 25.0% |
| Dec 01 | 48 | 10 | 20.8% |
| Dec 08 | 11 | 3 | 27.3% |
**DORA Performance Tiers:**
- Elite: ≤ 15%
- High: 16-30%
- Medium: 31-45%
- Low: > 45%