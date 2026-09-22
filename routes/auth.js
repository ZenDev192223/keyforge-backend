const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

// POST /api/auth/login
// Body: { username, password }
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "username and password are required" });
    }

    const admin = db.prepare("SELECT * FROM admins WHERE username = ?").get(username);
    if (!admin) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = bcrypt.compareSync(password, admin.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    res.json({
      token,
      admin: { id: admin.id, username: admin.username },
    });
  })
);

// GET /api/auth/me  (verify a token / fetch current admin)
router.get(
  "/me",
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json({ admin: req.admin });
  })
);

// POST /api/auth/register
// Only usable by an already-authenticated admin, to create additional admin accounts.
router.post(
  "/register",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "username and password are required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "password must be at least 8 characters" });
    }

    const existing = db.prepare("SELECT id FROM admins WHERE username = ?").get(username);
    if (existing) {
      return res.status(409).json({ error: "username already taken" });
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = db
      .prepare("INSERT INTO admins (username, password_hash) VALUES (?, ?)")
      .run(username, hash);

    res.status(201).json({ id: result.lastInsertRowid, username });
  })
);

module.exports = router;
