# Forecast methodology

All financial inputs use rupees at the interface and integer paise in storage and calculations. Fractional quantities use thousandths. Line totals and taxes round half-up to the nearest paisa. All business dates are calendar dates in Asia/Kolkata. Sample Studio freezes its planning date at 21 November 2026.

**Outstanding** equals the issued invoice total less its non-reversed payments. Drafts do not contribute to receivables. Disputes and overdue flags leave the payment history intact.

**Recorded cash** equals the opening balance plus non-reversed receipts minus paid bill occurrences from the opening date through the as-of date, inclusive. Treat the opening balance as the balance at the start of that date. Receipts from earlier dates reduce invoice balances without increasing opening cash a second time.

**Expected receipts** are limited to each unpaid invoice balance. A confirmed promise takes priority up to its amount. Receipts recorded since confirmation reduce it. Allocate collected money and the portion assigned to the promise against the earliest milestones. Forecast the remaining milestone amounts on confirmed dates or, when the studio enables the policy, their due dates. Use the invoice due date for the unallocated remainder. A missed promise, overdue amount without a revised date or disputed invoice appears separately as unforecasted. Dated amounts beyond the horizon have their own total.

**Bills** use scheduled occurrences. Monthly recurrence stays anchored to the original day and clamps to the end of shorter months. Weekly recurrence advances seven days. Paying one occurrence removes it from future outflows. Carry past-due unpaid bills to the first projection day while preserving their original due dates.

**Projected daily close** equals the preceding close plus expected receipts minus unpaid bills. The first day starts with recorded cash. The chart's opening point represents recorded cash. The projection, minimum and negative-day count use daily closes in a 30, 60 or 90 day inclusive window. Intraday order and statistical likelihood are outside the model.

**Scenarios** move dated unpaid receipts for the selected invoice and optionally substitute the amount of each unpaid occurrence of one expense. They recompute all daily closing balances. A saved scenario stores assumptions and reuses current studio records when reopened. Invoices, confirmed promises and the payment ledger are untouched.

## Reference case

| Date | Baseline close | Client A delayed 15 days |
| --- | ---: | ---: |
| 21 Nov | ₹18,000 | ₹18,000 |
| 27 Nov | ₹53,000 | ₹18,000 |
| 1 Dec | ₹28,000 | −₹7,000 |
| 3 Dec | ₹40,000 | ₹5,000 |
| 5 Dec | ₹31,000 | −₹4,000 |
| 6 Dec | ₹17,000 | −₹18,000 |
| 12 Dec | ₹17,000 | ₹17,000 |

The delayed case has nine negative closing days. The additional overdue sample invoice has no confirmed date. Its ₹6,500 appears in outstanding receivables, outside the dated forecast. Sample historical receipts predate the opening balance.
