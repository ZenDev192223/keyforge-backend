const express = require("express");
const db = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

const ALLOWED_SORT = {
  price_asc: "price ASC",
  price_desc: "price DESC",
  newest: "created_at DESC",
  rating: "rating DESC",
  name: "name ASC",
};

function serializeProduct(row) {
  return { ...row, is_featured: !!row.is_featured };
}

// ---------------------------------------------------------------------------
// PUBLIC ROUTES
// ---------------------------------------------------------------------------

// GET /api/products
// Query params: category, brand, search, minPrice, maxPrice, sort, page, limit, featured
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const {
      category,
      brand,
      search,
      minPrice,
      maxPrice,
      sort = "newest",
      page = 1,
      limit = 12,
      featured,
    } = req.query;

    const where = [];
    const params = {};

    if (category) {
      where.push("category = @category");
      params.category = category;
    }
    if (brand) {
      where.push("brand = @brand");
      params.brand = brand;
    }
    if (search) {
      where.push("(name LIKE @search OR brand LIKE @search OR description LIKE @search)");
      params.search = `%${search}%`;
    }
    if (minPrice) {
      where.push("price >= @minPrice");
      params.minPrice = Number(minPrice);
    }
    if (maxPrice) {
      where.push("price <= @maxPrice");
      params.maxPrice = Number(maxPrice);
    }
    if (featured === "true") {
      where.push("is_featured = 1");
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const orderSql = ALLOWED_SORT[sort] || ALLOWED_SORT.newest;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 12));
    const offset = (pageNum - 1) * limitNum;

    const total = db
      .prepare(`SELECT COUNT(*) AS count FROM products ${whereSql}`)
      .get(params).count;

    const rows = db
      .prepare(
        `SELECT * FROM products ${whereSql} ORDER BY ${orderSql} LIMIT @limit OFFSET @offset`
      )
      .all({ ...params, limit: limitNum, offset });

    res.json({
      data: rows.map(serializeProduct),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  })
);

// GET /api/products/meta/categories - distinct categories with counts
router.get(
  "/meta/categories",
  asyncHandler(async (req, res) => {
    const rows = db
      .prepare(
        `SELECT category, COUNT(*) AS count FROM products GROUP BY category ORDER BY category`
      )
      .all();
    res.json(rows);
  })
);

// GET /api/products/meta/brands - distinct brands with counts
router.get(
  "/meta/brands",
  asyncHandler(async (req, res) => {
    const rows = db
      .prepare(`SELECT brand, COUNT(*) AS count FROM products GROUP BY brand ORDER BY brand`)
      .all();
    res.json(rows);
  })
);

// GET /api/products/:id
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const product = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(serializeProduct(product));
  })
);

// ---------------------------------------------------------------------------
// ADMIN ROUTES (protected)
// ---------------------------------------------------------------------------

const REQUIRED_FIELDS = ["name", "brand", "category", "price", "stock"];

function validateProductBody(body) {
  const missing = REQUIRED_FIELDS.filter((f) => body[f] === undefined || body[f] === "");
  if (missing.length) return `Missing required fields: ${missing.join(", ")}`;
  if (isNaN(Number(body.price)) || Number(body.price) < 0) return "price must be a non-negative number";
  if (isNaN(Number(body.stock)) || Number(body.stock) < 0) return "stock must be a non-negative integer";
  return null;
}

// POST /api/products  (admin)
router.post(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const err = validateProductBody(req.body);
    if (err) return res.status(400).json({ error: err });

    const {
      name,
      brand,
      category,
      switch_type = null,
      layout = null,
      connectivity = null,
      description = "",
      price,
      discount_price = null,
      stock,
      image_url = null,
      is_featured = 0,
    } = req.body;

    const result = db
      .prepare(
        `INSERT INTO products
          (name, brand, category, switch_type, layout, connectivity, description,
           price, discount_price, stock, image_url, is_featured)
         VALUES (@name, @brand, @category, @switch_type, @layout, @connectivity, @description,
           @price, @discount_price, @stock, @image_url, @is_featured)`
      )
      .run({
        name,
        brand,
        category,
        switch_type,
        layout,
        connectivity,
        description,
        price: Number(price),
        discount_price: discount_price === null || discount_price === "" ? null : Number(discount_price),
        stock: Number(stock),
        image_url,
        is_featured: is_featured ? 1 : 0,
      });

    const created = db.prepare("SELECT * FROM products WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json(serializeProduct(created));
  })
);

// PUT /api/products/:id  (admin) - partial update
router.put(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const existing = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "Product not found" });

    const editable = [
      "name",
      "brand",
      "category",
      "switch_type",
      "layout",
      "connectivity",
      "description",
      "price",
      "discount_price",
      "stock",
      "image_url",
      "is_featured",
    ];

    const updates = {};
    for (const field of editable) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    if (updates.is_featured !== undefined) updates.is_featured = updates.is_featured ? 1 : 0;
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields provided to update" });
    }

    const setSql = Object.keys(updates)
      .map((f) => `${f} = @${f}`)
      .join(", ");

    db.prepare(
      `UPDATE products SET ${setSql}, updated_at = datetime('now') WHERE id = @id`
    ).run({ ...updates, id: req.params.id });

    const updated = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
    res.json(serializeProduct(updated));
  })
);

// DELETE /api/products/:id  (admin)
router.delete(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const existing = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "Product not found" });

    db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
    res.json({ message: "Product deleted", id: Number(req.params.id) });
  })
);

module.exports = router;
