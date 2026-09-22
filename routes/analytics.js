const express = require("express");
const db = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(requireAdmin);

// GET /api/analytics/summary
// High-level KPI cards: revenue, orders, avg order value, low-stock count, etc.
router.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const revenue = db
      .prepare(
        `SELECT COALESCE(SUM(total_amount), 0) AS total
         FROM orders WHERE status != 'cancelled'`
      )
      .get().total;

    const totalOrders = db.prepare(`SELECT COUNT(*) AS count FROM orders`).get().count;

    const ordersByStatus = db
      .prepare(`SELECT status, COUNT(*) AS count FROM orders GROUP BY status`)
      .all();

    const totalProducts = db.prepare(`SELECT COUNT(*) AS count FROM products`).get().count;

    const lowStockCount = db
      .prepare(`SELECT COUNT(*) AS count FROM products WHERE stock <= 5`)
      .get().count;

    const avgOrderValue = totalOrders
      ? Number(
          (
            db.prepare(`SELECT COALESCE(SUM(total_amount),0) AS s FROM orders WHERE status != 'cancelled'`).get()
              .s / Math.max(1, db.prepare(`SELECT COUNT(*) AS c FROM orders WHERE status != 'cancelled'`).get().c)
          ).toFixed(2)
        )
      : 0;

    res.json({
      totalRevenue: Number(revenue.toFixed(2)),
      totalOrders,
      avgOrderValue,
      totalProducts,
      lowStockCount,
      ordersByStatus,
    });
  })
);

// GET /api/analytics/sales-over-time?days=30
// Daily revenue + order count for the last N days -> for a line/bar chart
router.get(
  "/sales-over-time",
  asyncHandler(async (req, res) => {
    const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 30));

    const rows = db
      .prepare(
        `SELECT date(created_at) AS day,
                COUNT(*) AS orders,
                COALESCE(SUM(total_amount), 0) AS revenue
         FROM orders
         WHERE created_at >= date('now', @range) AND status != 'cancelled'
         GROUP BY date(created_at)
         ORDER BY day ASC`
      )
      .all({ range: `-${days} days` });

    res.json(rows.map((r) => ({ ...r, revenue: Number(r.revenue.toFixed(2)) })));
  })
);

// GET /api/analytics/top-products?limit=5
// Best-selling products by quantity sold -> for a bar chart
router.get(
  "/top-products",
  asyncHandler(async (req, res) => {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 5));

    const rows = db
      .prepare(
        `SELECT oi.product_id,
                oi.product_name,
                SUM(oi.quantity) AS units_sold,
                SUM(oi.unit_price * oi.quantity) AS revenue
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE o.status != 'cancelled'
         GROUP BY oi.product_id, oi.product_name
         ORDER BY units_sold DESC
         LIMIT ?`
      )
      .all(limit);

    res.json(rows.map((r) => ({ ...r, revenue: Number(r.revenue.toFixed(2)) })));
  })
);

// GET /api/analytics/category-breakdown
// Revenue share by product category -> for a pie/donut chart
router.get(
  "/category-breakdown",
  asyncHandler(async (req, res) => {
    const rows = db
      .prepare(
        `SELECT p.category AS category,
                SUM(oi.quantity) AS units_sold,
                SUM(oi.unit_price * oi.quantity) AS revenue
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         LEFT JOIN products p ON p.id = oi.product_id
         WHERE o.status != 'cancelled'
         GROUP BY p.category
         ORDER BY revenue DESC`
      )
      .all();

    res.json(rows.map((r) => ({ ...r, revenue: Number((r.revenue || 0).toFixed(2)) })));
  })
);

// GET /api/analytics/inventory
// Stock levels per product -> for an inventory bar chart / low-stock table
router.get(
  "/inventory",
  asyncHandler(async (req, res) => {
    const rows = db
      .prepare(
        `SELECT id, name, brand, category, stock, price
         FROM products
         ORDER BY stock ASC`
      )
      .all();
    res.json(rows);
  })
);

module.exports = router;
