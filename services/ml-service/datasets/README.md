# MessInsight ML Datasets

This directory holds dataset templates, historical attendance registers, and labelled feedback corpora.

## Principles & Transparency

1. **Synthetic Data Policy**:
   - Any synthetic or mock datasets must be stored in files with prefix or tag `synthetic_`.
   - Evaluation reports must explicitly declare when metrics originate from synthetic data vs. genuine mess feedback.
   - Synthetic metrics must never be represented as real-world production performance.

2. **Split Strategy**:
   - Attendance time-series data must ALWAYS use strictly chronological train / validation / test splits.
   - No random shuffling or future leakage is permitted.

3. **Data Quality Guidelines**:
   - Outliers must be flagged with audit notes, never silently pruned or zero-filled.
   - Missing attendance dates are kept distinct from zero attendance (0 is a valid attendance count, e.g. holiday closures).

