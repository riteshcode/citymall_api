/**
 * Orders that count as revenue in stats and reports: not cancelled, and the payment did not fail / get refunded.
 * One definition so the dashboard, sales report, top products and COD report always agree.
 */
export const EARNING_ORDER_FILTER = Object.freeze({
  status: { $ne: 'cancelled' },
  paymentStatus: { $nin: ['failed', 'refunded'] },
});
