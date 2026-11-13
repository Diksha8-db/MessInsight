# MessInsight — Key Performance Indicators & Metrics

> [!NOTE]
> **Data Transparency Notice**:
> All benchmarks documented below were obtained from model training and evaluation runs against synthetic college mess datasets (`DATA SOURCE: synthetic`).

---

## 1. Machine Learning Accuracy & Model Metrics

### A. Demand Prediction Model (`RandomForestRegressor`)
Evaluated on unseen historical meal turnout data (30 days $\times$ 3 meals, split 80/20 train/test):

| Metric | Target SLA | Verified Result | Status |
| :--- | :--- | :--- | :--- |
| **Mean Absolute Error (MAE)** | $< 15.0$ students | **3.52 students** | Exceeds Target |
| **Root Mean Squared Error (RMSE)**| $< 20.0$ students | **4.39 students** | Exceeds Target |
| **Naïve Baseline MAE** | N/A | **42.03 students** | — |
| **Error Reduction vs Baseline** | $> 50\%$ | **91.6% improvement** | Exceeds Target |
| **Inference Latency** | $< 50$ ms | **~8 ms** | Real-time |

### B. NLP Sentiment Analysis Model (`TF-IDF + Logistic Regression`)
Evaluated on multilingual and Hinglish student feedback dataset (119 labeled multi-class samples):

| Sentiment Class | Precision | Recall | F1-Score | Support |
| :--- | :--- | :--- | :--- | :--- |
| **POSITIVE** | 82.76% | 96.00% | **0.8889** | 50 |
| **NEGATIVE** | 78.69% | 94.12% | **0.8571** | 51 |
| **NEUTRAL** | 0.00% | 0.00% | 0.0000 | 8 |
| **MIXED** | 0.00% | 0.00% | 0.0000 | 7 |
| **UNCERTAIN** | 0.00% | 0.00% | 0.0000 | 3 |
| **Accuracy** | — | — | **80.67%** | 119 |
| **Macro Average** | 32.29% | 38.02% | 0.3492 | 119 |
| **Weighted Average** | 68.50% | 80.67% | **0.7408** | 119 |

*Note: The model exhibits strong discriminative ability on actionable positive and negative feedback ($F_1 > 0.85$), which directly informs kitchen actions.*

---

## 2. Operational & Canteen Performance Metrics

| Operational Metric | Target SLA | Measurement Method | Responsible Role |
| :--- | :--- | :--- | :--- |
| **Food Leftover Percentage** | $< 8.0\%$ of prepared | `leftoverQuantity / preparedQuantity` | Mess Manager |
| **Unaccounted Waste Variance** | $< 2.0\%$ | `|prepared - (consumed + leftover)| / prepared` | Mess Manager |
| **Average Meal Rating** | $\ge 3.8$ / 5.0 | Daily MongoDB aggregation | Head Chef / Manager |
| **Complaint Resolution SLA** | $< 48$ hours | Timestamp from `OPEN` to `RESOLVED` | Mess Manager |
| **Hygiene Complaint Escalation** | $0$ open $>24\text{h}$ | Filter on `category: FOOD_HYGIENE` | Campus Admin |

---

## 3. System & API Performance SLAs

| System Component | Target Metric | Architectural Defense |
| :--- | :--- | :--- |
| **API P95 Response Latency** | $< 200$ ms | Lean Mongoose repository queries & compound indexes |
| **ML Inference P99 Latency** | $< 100$ ms | In-memory joblib models in Python 3.11 |
| **Circuit Breaker Threshold** | Trip after 5 failures | 60s cooldown; automatic fallback to statistical weekday mean |
| **Max Payload Upload Size** | 5 MB | Magic byte MIME verification in memory |
| **CSV Export Streaming** | $< 500$ ms for 10k rows | Streaming response with formula injection sanitation |

---

## 4. Composite Quality Indices

### A. Feedback Quality Index (FQI)
To quantify mess dining satisfaction objectively across hostels:

$$\text{FQI} = 0.50 \times \left(\frac{\overline{R}}{5.0}\right) + 0.35 \times \left(\frac{\text{Sentiment Score} + 1.0}{2.0}\right) + 0.15 \times \left(1.0 - \frac{\text{Open Urgent Complaints}}{\max(1, \text{Total Complaints})}\right)$$

Where:
- $\overline{R}$: Average overall star rating ($1.0$ to $5.0$)
- $\text{Sentiment Score}$: Average sentiment score ($-1.0$ to $+1.0$)
- Complaint factor penalizes unresolved urgent hygiene issues

### B. Kitchen Efficiency Index (KEI)

$$\text{KEI} = 100\% - \left(\frac{\text{Total Leftover Quantity} + 2 \times \text{Unaccounted Difference}}{\text{Total Prepared Quantity}}\right) \times 100\%$$
