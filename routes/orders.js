const express = require("express");
const db = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

const VALID_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"];
const FREE_SHIPPING_THRESHOLD = 100;
const FLAT_SHIPPING_FEE = 9.99;

function getOrderWithItems(orderId) {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  if (!order) return null;
  const items = db
    .prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY id")
    .all(orderId);
  return { ...order, items };
}

// ---------------------------------------------------------------------------
// PUBLIC: place an order (checkout)
// ---------------------------------------------------------------------------
// POST /api/orders
// Body: {
//   customer_name, email, phone, address, city, postal_code, country,
//   payment_method,
//   items: [{ product_id, quantity }, ...]
// }
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const {
      customer_name,
      email,
      phone = null,
      address,
      city = null,
      postal_code = null,
      country = null,
      payment_method = "cod",
      items,
    } = req.body;

    if (!customer_name || !email || !address) {
      return res.status(400).json({ error: "customer_name, email and address are required" });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items must be a non-empty array" });
    }

    // Validate stock & compute totals inside a transaction so partial orders
    // never get created if something runs out of stock mid-way.
    const placeOrder = db.transaction(() => {
      let subtotal = 0;
      const resolvedItems = [];

      for (const item of items) {
        const product = db.prepare("SELECT * FROM products WHERE id = ?").get(item.product_id);
        if (!product) {
          throw { status: 404, message: `Product ${item.product_id} not found` };
        }
        const qty = Number(item.quantity);
        if (!qty || qty < 1) {
          throw { status: 400, message: `Invalid quantity for product ${item.product_id}` };
        }
        if (product.stock < qty) {
          throw {
            status: 409,
            message: `Insufficient stock for "${product.name}" (available: ${product.stock})`,
          };
        }

        const unitPrice = product.discount_price ?? product.price;
        subtotal += unitPrice * qty;
        resolvedItems.push({ product, qty, unitPrice });
      }

      const shipping_fee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_FEE;
      const total_amount = Number((subtotal + shipping_fee).toFixed(2));

      const orderResult = db
        .prepare(
          `INSERT INTO orders
            (customer_name, email, phone, address, city, postal_code, country,
             subtotal, shipping_fee, total_amount, payment_method, status)
           VALUES (@customer_name, @email, @phone, @address, @city, @postal_code, @country,
             @subtotal, @shipping_fee, @total_amount, @payment_method, 'pending')`
        )
        .run({
          customer_name,
          email,
          phone,
          address,
          city,
          postal_code,
          country,
          subtotal: Number(subtotal.toFixed(2)),
          shipping_fee,
          total_amount,
          payment_method,
        });

      const orderId = orderResult.lastInsertRowid;

      const insertItem = db.prepare(
        `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity)
         VALUES (?, ?, ?, ?, ?)`
      );
      const decrementStock = db.prepare(`UPDATE products SET stock = stock - ? WHERE id = ?`);

      for (const { product, qty, unitPrice } of resolvedItems) {
        insertItem.run(orderId, product.id, product.name, unitPrice, qty);
        decrementStock.run(qty, product.id);
      }

      return orderId;
    });

    let orderId;
    try {
      orderId = placeOrder();
    } catch (err) {
      if (err && err.status) return res.status(err.status).json({ error: err.message });
      throw err;
    }

    res.status(201).json(getOrderWithItems(orderId));
  })
);

// GET /api/orders/:id - order status lookup (used for "track my order")
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const order = getOrderWithItems(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  })
);

// ---------------------------------------------------------------------------
// ADMIN: list & manage all orders
// ---------------------------------------------------------------------------

// GET /api/orders (admin) - list all orders, optional ?status= filter, paginated
router.get(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 20 } = req.query;

    const where = [];
    const params = {};
    if (status) {
      where.push("status = @status");
      params.status = status;
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const total = db.prepare(`SELECT COUNT(*) AS count FROM orders ${whereSql}`).get(params).count;
    const rows = db
      .prepare(
        `SELECT * FROM orders ${whereSql} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`
      )
      .all({ ...params, limit: limitNum, offset });

    res.json({
      data: rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  })
);

// PUT /api/orders/:id/status (admin) - update order status
router.put(
  "/:id/status",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
    }

    const existing = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "Order not found" });

    db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(
      status,
      req.params.id
    );

    res.json(getOrderWithItems(req.params.id));
  })
);

module.exports = router;
