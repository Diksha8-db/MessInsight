# MessInsight — Key Performance Indicators & Metrics

## 1. Operational & Machine Learning Targets

| KPI | Target SLA | Current Benchmark | Measurement Method |
| :--- | :--- | :--- | :--- |
| **Attendance Forecast MAE** | $< 15$ students | **3.52 students** | Prediction accuracy evaluation against actual attendance |
| **Sentiment Model Accuracy** | $> 75\%$ | **80.67%** | Labeled validation dataset |
| **Food Leftover Percentage** | $< 8\%$ of prepared | Measured per ingredient | Waste tracking module (`leftover / prepared`) |
| **Unaccounted Waste Variance**| $< 2\%$ | Pre-save difference check | `prepared - (consumed + leftover)` |
| **Complaint Resolution SLA** | $< 48$ hours | Tracked via history timeline | Timestamp delta from `OPEN` to `RESOLVED` |
| **API P95 Response Latency** | $< 250$ ms | Monitored in Next.js handlers | Correlation ID structured logging |
| **Circuit Breaker Trip Rate**| $< 0.1\%$ | Logged in `circuitBreaker.ts` | 5 consecutive failures threshold |

---

## 2. Feedback Quality Index (FQI)

To quantify mess dining satisfaction objectively, campus administrators track the composite Feedback Quality Index:

$$\text{FQI} = 0.50 \times \left(\frac{\overline{R}}{5.0}\right) + 0.35 \times \left(\frac{\text{Sentiment Score} + 1.0}{2.0}\right) + 0.15 \times \left(1.0 - \frac{\text{Open Urgent Complaints}}{\max(1, \text{Total Complaints})}\right)$$

Where:
- $\overline{R}$: Average overall star rating ($1.0$ to $5.0$)
- $\text{Sentiment Score}$: Average sentiment score ($-1.0$ to $+1.0$)
- Complaint factor penalizes unresolved urgent hygiene issues

