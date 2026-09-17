const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const { readData, writeData } = require("../db");
const { requireAdmin } = require("../middleware/auth");
const { sendOrderConfirmedEmail } = require("../email");

const router = express.Router();

// ---------- Login ----------
router.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (
    username === process.env.ADMIN_USER &&
    password === process.env.ADMIN_PASSWORD
  ) {
    req.session.isAdmin = true;
    return res.json({ success: true });
  }
  res.status(401).json({ error: "Benutzername oder Passwort falsch." });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

router.get("/me", (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

// Alles ab hier erfordert Login
router.use(requireAdmin);

// ---------- Kategorien verwalten ----------
router.get("/categories", (req, res) => {
  res.json(readData("categories"));
});

router.post("/categories", (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Name fehlt." });
  const categories = readData("categories");
  const id = name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-äöüß]/gi, "");
  if (categories.some((c) => c.id === id)) {
    return res.status(400).json({ error: "Kategorie existiert bereits." });
  }
  categories.push({ id, name });
  writeData("categories", categories);
  res.json({ success: true, category: { id, name } });
});

router.put("/categories/:id", (req, res) => {
  const { name } = req.body;
  const categories = readData("categories");
  const cat = categories.find((c) => c.id === req.params.id);
  if (!cat) return res.status(404).json({ error: "Kategorie nicht gefunden." });
  cat.name = name || cat.name;
  writeData("categories", categories);
  res.json({ success: true });
});

router.delete("/categories/:id", (req, res) => {
  let categories = readData("categories");
  categories = categories.filter((c) => c.id !== req.params.id);
  writeData("categories", categories);
  res.json({ success: true });
});

// ---------- Produkte verwalten ----------
router.get("/products", (req, res) => {
  res.json(readData("products"));
});

router.post("/products", (req, res) => {
  const { title, description, price, category, images, active } = req.body;
  if (!title || price === undefined || !category) {
    return res.status(400).json({ error: "Titel, Preis und Kategorie sind Pflicht." });
  }
  const products = readData("products");
  const product = {
    id: uuidv4().slice(0, 8),
    title,
    description: description || "",
    price: Number(price),
    category,
    images: images || [],
    active: active !== false,
  };
  products.push(product);
  writeData("products", products);
  res.json({ success: true, product });
});

router.put("/products/:id", (req, res) => {
  const products = readData("products");
  const product = products.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: "Produkt nicht gefunden." });
  const { title, description, price, category, images, active } = req.body;
  if (title !== undefined) product.title = title;
  if (description !== undefined) product.description = description;
  if (price !== undefined) product.price = Number(price);
  if (category !== undefined) product.category = category;
  if (images !== undefined) product.images = images;
  if (active !== undefined) product.active = active;
  writeData("products", products);
  res.json({ success: true, product });
});

router.delete("/products/:id", (req, res) => {
  let products = readData("products");
  products = products.filter((p) => p.id !== req.params.id);
  writeData("products", products);
  res.json({ success: true });
});

// ---------- Bild-Upload ----------
const uploadDir = path.join(__dirname, "..", "..", "public", "images", "products");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
  fileFilter: (req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error("Nur Bilddateien sind erlaubt (jpg, png, webp, gif)."));
    }
  },
});

router.post("/upload", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Keine Datei erhalten." });
  res.json({ success: true, url: `/images/products/${req.file.filename}` });
});

// ---------- Bestellungen ansehen & bestätigen ----------
router.get("/orders", (req, res) => {
  const orders = readData("orders").sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  res.json(orders);
});

router.post("/orders/:id/confirm", async (req, res) => {
  const orders = readData("orders");
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: "Bestellung nicht gefunden." });
  order.status = "confirmed";
  writeData("orders", orders);
  try {
    await sendOrderConfirmedEmail(order);
  } catch (e) {
    console.error("E-Mail-Fehler (Bestätigung):", e);
  }
  res.json({ success: true });
});

router.post("/orders/:id/ship", (req, res) => {
  const orders = readData("orders");
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: "Bestellung nicht gefunden." });
  order.status = "shipped";
  writeData("orders", orders);
  res.json({ success: true });
});

// ---------- Gutscheine verwalten ----------
router.get("/coupons", (req, res) => {
  res.json(readData("coupons"));
});

router.post("/coupons", (req, res) => {
  const { code, value } = req.body;
  if (!code || value === undefined) {
    return res.status(400).json({ error: "Code und Wert sind Pflicht." });
  }
  const coupons = readData("coupons");
  if (coupons.some((c) => c.code.toLowerCase() === code.toLowerCase())) {
    return res.status(400).json({ error: "Gutscheincode existiert bereits." });
  }
  const coupon = { code, value: Number(value), used: false };
  coupons.push(coupon);
  writeData("coupons", coupons);
  res.json({ success: true, coupon });
});

router.delete("/coupons/:code", (req, res) => {
  let coupons = readData("coupons");
  coupons = coupons.filter(
    (c) => c.code.toLowerCase() !== req.params.code.toLowerCase()
  );
  writeData("coupons", coupons);
  res.json({ success: true });
});

module.exports = router;
