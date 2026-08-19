const Order    = require('../models/Order');
const Product  = require('../models/Product');
const Customer = require('../models/Customer');
const asyncHandler = require('../middleware/async');

// ── @route  GET /api/v1/dashboard/stats ───────────────────────────
exports.getDashboardStats = asyncHandler(async (req, res) => {
  const now = new Date();

  // Start of current month (UTC midnight)
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  // Start of next month = end of this month
  const startOfNextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  // Start of last month
  const startOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

  // Run all queries in parallel – same as the original Promise.all pattern
  const [
    totalOrders,
    totalProducts,
    totalCustomers,
    revenue,
    monthOrders,
    lastMonthOrders,
    recentOrders,
    ordersByStatus,
  ] = await Promise.all([
    Order.count(),
    Product.countAvailable(),
    Customer.countActive(),
    Order.totalRevenue(),
    Order.countInRange(startOfMonth, startOfNextMonth),
    Order.countInRange(startOfLastMonth, startOfMonth),
    Order.findRecent(5),
    Order.countByStatus(),
  ]);

  
  const orderGrowth =
    lastMonthOrders === 0
      ? 100
      : Number((((monthOrders - lastMonthOrders) / lastMonthOrders) * 100).toFixed(1));

  res.status(200).json({
    success: true,
    data: {
      overview: {
        totalOrders,
        totalProducts,
        totalCustomers,
        revenue,
      },
      growth: {
        ordersThisMonth:    monthOrders,
        ordersLastMonth:    lastMonthOrders,
        orderGrowthPercent: orderGrowth,
      },
      ordersByStatus,
      recentOrders,   
    },
  });
});
