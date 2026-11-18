import { Order } from '../models/Order.js';
import { User } from '../models/User.js';
import { addDaysToStoreDate, formatStoreDate, parseDateBoundary, storeTimezoneOffset } from '../utils/dates.js';
import { EARNING_ORDER_FILTER } from '../utils/orderFilters.js';

/**
 * Admin reports. Money in paise; days are IST days. Revenue-style numbers use EARNING_ORDER_FILTER (the same rule as
 * the dashboard): cancelled orders and orders whose payment failed / was refunded are excluded.
 */

/** `from`/`to` default to the last 30 days (today included). Date-only values cover the whole IST day. */
function resolveRange({ from, to }) {
  const toDate = to ?? formatStoreDate();
  const fromDate = from ?? addDaysToStoreDate(toDate.slice(0, 10), -29);
  return { $gte: parseDateBoundary(fromDate, 'start'), $lte: parseDateBoundary(toDate, 'end') };
}

const PERIOD_FORMAT = { day: '%Y-%m-%d', week: '%Y-%m-%d', month: '%Y-%m' };

/**
 * Sales per period: [{ period, orders, revenue, avgOrderValue }], oldest first. `period` is the IST date
 * (day), the Monday that starts the week (week) or YYYY-MM (month). Periods with no orders are omitted.
 */
export async function salesReport({ from, to, groupBy = 'day' }) {
  const timezone = storeTimezoneOffset();
  const trunc = { date: '$createdAt', unit: groupBy, timezone };
  if (groupBy === 'week') trunc.startOfWeek = 'monday';

  return Order.aggregate([
    { $match: { createdAt: resolveRange({ from, to }), ...EARNING_ORDER_FILTER } },
    { $group: { _id: { $dateTrunc: trunc }, orders: { $sum: 1 }, revenue: { $sum: '$pricing.total' } } },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        period: { $dateToString: { date: '$_id', format: PERIOD_FORMAT[groupBy], timezone } },
        orders: 1,
        revenue: 1,
        avgOrderValue: { $round: [{ $divide: ['$revenue', '$orders'] }, 0] },
      },
    },
  ]);
}

/** Best sellers: [{ productId, title, qtySold, revenue }]. Revenue = line totals (price x qty) before any coupon. */
export async function topProductsReport({ from, to, limit = 10 }) {
  const rows = await Order.aggregate([
    { $match: { createdAt: resolveRange({ from, to }), ...EARNING_ORDER_FILTER } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        title: { $first: '$items.title' },
        qtySold: { $sum: '$items.qty' },
        revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } },
      },
    },
    { $sort: { qtySold: -1, revenue: -1, _id: 1 } },
    { $limit: limit },
  ]);
  return rows.map((r) => ({
    productId: r._id.toString(),
    title: { en: r.title.en, hi: r.title.hi },
    qtySold: r.qtySold,
    revenue: r.revenue,
  }));
}

/**
 * Cash reconciliation for one IST day: COD orders DELIVERED that day. `expected` is what the customers owed,
 * `collected` is what the riders reported (cashCollected). Orders closed by an admin (no rider / no cash figure)
 * show up under rider: null with collected 0, which is exactly the gap an accountant wants to see.
 */
export async function codReport({ date }) {
  const day = { $gte: parseDateBoundary(date, 'start'), $lte: parseDateBoundary(date, 'end') };
  const groups = await Order.aggregate([
    {
      $match: {
        paymentMethod: 'cod',
        status: 'delivered',
        ...{ paymentStatus: EARNING_ORDER_FILTER.paymentStatus },
        statusHistory: { $elemMatch: { status: 'delivered', at: day } },
      },
    },
    {
      $group: {
        _id: '$rider',
        orders: { $sum: 1 },
        expected: { $sum: '$pricing.total' },
        collected: { $sum: { $ifNull: ['$cashCollected', 0] } },
      },
    },
  ]);

  const riderIds = groups.map((g) => g._id).filter(Boolean);
  const riders = await User.find({ _id: { $in: riderIds } }).select('name mobile').lean();
  const riderById = new Map(riders.map((r) => [r._id.toString(), r]));

  const byRider = groups
    .map((g) => {
      const rider = g._id ? riderById.get(g._id.toString()) : null;
      return {
        rider: rider ? { id: rider._id.toString(), name: rider.name, mobile: rider.mobile } : null,
        orders: g.orders,
        expected: g.expected,
        collected: g.collected,
      };
    })
    // riders A-Z, then the "no rider" row last (explicit: a '~' sentinel would sort FIRST under locale collation)
    .sort((a, b) => (a.rider === null) - (b.rider === null) || (a.rider?.name ?? '').localeCompare(b.rider?.name ?? ''));

  return {
    date,
    totalExpected: byRider.reduce((sum, r) => sum + r.expected, 0),
    totalCollected: byRider.reduce((sum, r) => sum + r.collected, 0),
    byRider,
  };
}
