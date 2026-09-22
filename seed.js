require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("./config/db");

console.log("Seeding database...");

// ---------------------------------------------------------------------------
// Admin account
// ---------------------------------------------------------------------------
const adminUsername = process.env.ADMIN_USERNAME || "admin";
const adminPassword = process.env.ADMIN_PASSWORD || "Admin@12345";

const existingAdmin = db.prepare("SELECT id FROM admins WHERE username = ?").get(adminUsername);
if (!existingAdmin) {
  const hash = bcrypt.hashSync(adminPassword, 10);
  db.prepare("INSERT INTO admins (username, password_hash) VALUES (?, ?)").run(
    adminUsername,
    hash
  );
  console.log(`Created admin user "${adminUsername}"`);
} else {
  console.log(`Admin user "${adminUsername}" already exists, skipping`);
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------
const productCount = db.prepare("SELECT COUNT(*) AS c FROM products").get().c;

if (productCount === 0) {
  const products = [
    {
      name: "Apex Pro TKL",
      brand: "SteelEdge",
      category: "mechanical",
      switch_type: "Tactile",
      layout: "TKL",
      connectivity: "Wired",
      description: "Tenkeyless mechanical keyboard with hot-swappable tactile switches and per-key RGB.",
      price: 129.99,
      discount_price: 109.99,
      stock: 42,
      image_url: "https://images.unsplash.com/photo-1595225476474-63038da0d2b8",
      rating: 4.6,
      rating_count: 210,
      is_featured: 1,
    },
    {
      name: "Nimbus 60 Wireless",
      brand: "CloudType",
      category: "wireless",
      switch_type: "Linear",
      layout: "60%",
      connectivity: "Bluetooth",
      description: "Ultra-compact 60% wireless keyboard, tri-mode connectivity, 300h battery life.",
      price: 89.0,
      discount_price: null,
      stock: 65,
      image_url: "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef",
      rating: 4.4,
      rating_count: 156,
      is_featured: 1,
    },
    {
      name: "Vortex Gaming K7",
      brand: "RapidFire",
      category: "gaming",
      switch_type: "Clicky",
      layout: "Full-size",
      connectivity: "Wired",
      description: "Full-size gaming keyboard with 1000Hz polling rate, clicky switches and macro keys.",
      price: 149.99,
      discount_price: 129.99,
      stock: 30,
      image_url: "https://images.unsplash.com/photo-1595044426077-d36d9236d54a",
      rating: 4.7,
      rating_count: 340,
      is_featured: 1,
    },
    {
      name: "EchoWave Membrane 104",
      brand: "OfficePro",
      category: "membrane",
      switch_type: "Rubber Dome",
      layout: "Full-size",
      connectivity: "Wired",
      description: "Quiet, budget-friendly membrane keyboard built for all-day office typing.",
      price: 24.99,
      discount_price: null,
      stock: 120,
      image_url: "https://images.unsplash.com/photo-1587829741301-dc798b83add3",
      rating: 4.1,
      rating_count: 89,
      is_featured: 0,
    },
    {
      name: "ErgoSplit Curve",
      brand: "PostureTech",
      category: "ergonomic",
      switch_type: "Tactile",
      layout: "Split",
      connectivity: "Wired",
      description: "Split ergonomic design with adjustable tenting to reduce wrist strain.",
      price: 179.0,
      discount_price: 159.0,
      stock: 18,
      image_url: "https://images.unsplash.com/photo-1587829991547-3b0d3f14b3b8",
      rating: 4.5,
      rating_count: 74,
      is_featured: 1,
    },
    {
      name: "Titan 65 Compact",
      brand: "SteelEdge",
      category: "mechanical",
      switch_type: "Linear",
      layout: "65%",
      connectivity: "Wired",
      description: "Aluminum-frame 65% board with gasket mount for a soft, muted typing feel.",
      price: 139.0,
      discount_price: null,
      stock: 25,
      image_url: "https://images.unsplash.com/photo-1618384887924-3f649f47cc0e",
      rating: 4.8,
      rating_count: 132,
      is_featured: 0,
    },
    {
      name: "AirType Slim",
      brand: "CloudType",
      category: "wireless",
      switch_type: "Scissor",
      layout: "Full-size",
      connectivity: "2.4GHz",
      description: "Ultra-thin low-profile wireless keyboard designed to pair with any laptop setup.",
      price: 59.99,
      discount_price: 49.99,
      stock: 70,
      image_url: "https://images.unsplash.com/photo-1587829992747-9509eb08e4b7",
      rating: 4.2,
      rating_count: 98,
      is_featured: 0,
    },
    {
      name: "Vortex Gaming Mini",
      brand: "RapidFire",
      category: "gaming",
      switch_type: "Clicky",
      layout: "60%",
      connectivity: "Wired",
      description: "Compact 60% gaming keyboard tuned for competitive FPS play, detachable cable.",
      price: 99.99,
      discount_price: null,
      stock: 5,
      image_url: "https://images.unsplash.com/photo-1595225476474-63038da0d2b8",
      rating: 4.3,
      rating_count: 51,
      is_featured: 0,
    },
    {
      name: "Classic 101 Membrane",
      brand: "OfficePro",
      category: "membrane",
      switch_type: "Rubber Dome",
      layout: "Full-size",
      connectivity: "Wired",
      description: "No-frills, reliable membrane keyboard for everyday use.",
      price: 14.99,
      discount_price: null,
      stock: 200,
      image_url: "https://images.unsplash.com/photo-1587829741301-dc798b83add3",
      rating: 3.9,
      rating_count: 45,
      is_featured: 0,
    },
    {
      name: "ErgoSplit Mini",
      brand: "PostureTech",
      category: "ergonomic",
      switch_type: "Linear",
      layout: "Split 60%",
      connectivity: "Bluetooth",
      description: "Compact split ergonomic keyboard with wireless freedom and tenting legs.",
      price: 154.0,
      discount_price: null,
      stock: 3,
      image_url: "https://images.unsplash.com/photo-1587829991547-3b0d3f14b3b8",
      rating: 4.4,
      rating_count: 22,
      is_featured: 0,
    },
  ];

  const insert = db.prepare(
    `INSERT INTO products
      (name, brand, category, switch_type, layout, connectivity, description,
       price, discount_price, stock, image_url, rating, rating_count, is_featured)
     VALUES (@name, @brand, @category, @switch_type, @layout, @connectivity, @description,
       @price, @discount_price, @stock, @image_url, @rating, @rating_count, @is_featured)`
  );

  const insertMany = db.transaction((items) => {
    for (const item of items) insert.run(item);
  });

  insertMany(products);
  console.log(`Inserted ${products.length} keyboard products`);
} else {
  console.log(`Products table already has ${productCount} rows, skipping product seed`);
}

// ---------------------------------------------------------------------------
// Sample orders (so the analytics dashboard has something to show immediately)
// ---------------------------------------------------------------------------
const orderCount = db.prepare("SELECT COUNT(*) AS c FROM orders").get().c;

if (orderCount === 0) {
  const allProducts = db.prepare("SELECT * FROM products").all();
  const statuses = ["delivered", "delivered", "shipped", "processing", "pending", "cancelled"];
  const names = ["Alex Kim", "Priya Nair", "Jordan Lee", "Sam Patel", "Maria Chen", "Tom Wright"];

  const insertOrder = db.prepare(
    `INSERT INTO orders
      (customer_name, email, address, city, country, subtotal, shipping_fee, total_amount,
       status, payment_method, created_at)
     VALUES (@customer_name, @email, @address, @city, @country, @subtotal, @shipping_fee,
       @total_amount, @status, @payment_method, @created_at)`
  );
  const insertItem = db.prepare(
    `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity)
     VALUES (?, ?, ?, ?, ?)`
  );

  const insertSampleOrders = db.transaction(() => {
    for (let i = 0; i < 25; i++) {
      const daysAgo = Math.floor(Math.random() * 45);
      const numItems = 1 + Math.floor(Math.random() * 3);
      let subtotal = 0;
      const chosen = [];

      for (let j = 0; j < numItems; j++) {
        const product = allProducts[Math.floor(Math.random() * allProducts.length)];
        const qty = 1 + Math.floor(Math.random() * 2);
        const unitPrice = product.discount_price ?? product.price;
        subtotal += unitPrice * qty;
        chosen.push({ product, qty, unitPrice });
      }

      const shipping_fee = subtotal >= 100 ? 0 : 9.99;
      const total_amount = Number((subtotal + shipping_fee).toFixed(2));
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const name = names[Math.floor(Math.random() * names.length)];

      const result = insertOrder.run({
        customer_name: name,
        email: `${name.toLowerCase().replace(" ", ".")}@example.com`,
        address: "123 Sample St",
        city: "Springfield",
        country: "USA",
        subtotal: Number(subtotal.toFixed(2)),
        shipping_fee,
        total_amount,
        status,
        payment_method: "card",
        created_at: `datetime('now', '-${daysAgo} days')`,
      });

      // created_at needs to be a raw SQL expression, not a bound param, so patch it:
      db.prepare(`UPDATE orders SET created_at = datetime('now', ?) WHERE id = ?`).run(
        `-${daysAgo} days`,
        result.lastInsertRowid
      );

      for (const { product, qty, unitPrice } of chosen) {
        insertItem.run(result.lastInsertRowid, product.id, product.name, unitPrice, qty);
      }
    }
  });

  insertSampleOrders();
  console.log("Inserted 25 sample orders with order items");
} else {
  console.log(`Orders table already has ${orderCount} rows, skipping order seed`);
}

console.log("Seeding complete.");
console.log(`\nAdmin login -> username: "${adminUsername}", password: "${adminPassword}"`);
