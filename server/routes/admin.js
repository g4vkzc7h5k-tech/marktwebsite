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

// Kleiner Helfer, damit nicht jede Route einzeln try/catch schreiben muss
function wrap(fn) {
  return (req, res) => {
    Promise.resolve(fn(req, res)).catch((e) => {
      console.error(e);
      res.status(500).json({ error: "Serverfehler. Bitte Render-Logs prüfen." });
    });
  };
}

// ---------- Kategorien verwalten ----------
router.get(
  "/categories",
  wrap(async (req, res) => {
    res.json(await readData("categories"));
  })
);

router.post(
  "/categories",
  wrap(async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name fehlt." });
    const categories = await readData("categories");
    const id = name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-äöüß]/gi, "");
    if (categories.some((c) => c.id === id)) {
      return res.status(400).json({ error: "Kategorie existiert bereits." });
    }
    categories.push({ id, name });
    await writeData("categories", categories);
    res.json({ success: true, category: { id, name } });
  })
);

router.put(
  "/categories/:id",
  wrap(async (req, res) => {
    const { name } = req.body;
    const categories = await readData("categories");
    const cat = categories.find((c) => c.id === req.params.id);
    if (!cat) return res.status(404).json({ error: "Kategorie nicht gefunden." });
    cat.name = name || cat.name;
    await writeData("categories", categories);
    res.json({ success: true });
  })
);

router.delete(
  "/categories/:id",
  wrap(async (req, res) => {
    let categories = await readData("categories");
    categories = categories.filter((c) => c.id !== req.params.id);
    await writeData("categories", categories);
    res.json({ success: true });
  })
);

// ---------- Produkte verwalten ----------
router.get(
  "/products",
  wrap(async (req, res) => {
    res.json(await readData("products"));
  })
);

router.post(
  "/products",
  wrap(async (req, res) => {
    const { title, description, price, category, images, active } = req.body;
    if (!title || price === undefined || !category) {
      return res.status(400).json({ error: "Titel, Preis und Kategorie sind Pflicht." });
    }
    const products = await readData("products");
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
    await writeData("products", products);
    res.json({ success: true, product });
  })
);

router.put(
  "/products/:id",
  wrap(async (req, res) => {
    const products = await readData("products");
    const product = products.find((p) => p.id === req.params.id);
    if (!product) return res.status(404).json({ error: "Produkt nicht gefunden." });
    const { title, description, price, category, images, active } = req.body;
    if (title !== undefined) product.title = title;
    if (description !== undefined) product.description = description;
    if (price !== undefined) product.price = Number(price);
    if (category !== undefined) product.category = category;
    if (images !== undefined) product.images = images;
    if (active !== undefined) product.active = active;
    await writeData("products", products);
    res.json({ success: true, product });
  })
);

router.delete(
  "/products/:id",
  wrap(async (req, res) => {
    let products = await readData("products");
    products = products.filter((p) => p.id !== req.params.id);
    await writeData("products", products);
    res.json({ success: true });
  })
);

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
router.get(
  "/orders",
  wrap(async (req, res) => {
    const orders = (await readData("orders")).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    res.json(orders);
  })
);

router.post(
  "/orders/:id/confirm",
  wrap(async (req, res) => {
    const orders = await readData("orders");
    const order = orders.find((o) => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: "Bestellung nicht gefunden." });
    order.status = "confirmed";
    await writeData("orders", orders);

    // Sofort antworten, E-Mail läuft im Hintergrund weiter.
    res.json({ success: true });

    sendOrderConfirmedEmail(order).catch((e) =>
      console.error("E-Mail-Fehler (Bestätigung):", e)
    );
  })
);

router.post(
  "/orders/:id/prepare",
  wrap(async (req, res) => {
    const orders = await readData("orders");
    const order = orders.find((o) => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: "Bestellung nicht gefunden." });
    order.status = "preparing";
    await writeData("orders", orders);
    res.json({ success: true });
  })
);

router.post(
  "/orders/:id/ship",
  wrap(async (req, res) => {
    const orders = await readData("orders");
    const order = orders.find((o) => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: "Bestellung nicht gefunden." });
    order.status = "shipped";
    await writeData("orders", orders);
    res.json({ success: true });
  })
);

router.post(
  "/orders/:id/deliver",
  wrap(async (req, res) => {
    const orders = await readData("orders");
    const order = orders.find((o) => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: "Bestellung nicht gefunden." });
    order.status = "delivered";
    await writeData("orders", orders);
    res.json({ success: true });
  })
);

// ---------- Bewertungen verwalten ----------
router.get(
  "/reviews",
  wrap(async (req, res) => {
    res.json(await readData("reviews"));
  })
);

router.post(
  "/reviews",
  wrap(async (req, res) => {
    const { category, text, stars } = req.body;
    if (!category || !text || !stars) {
      return res.status(400).json({ error: "Kategorie, Text und Sterne sind Pflicht." });
    }
    const reviews = await readData("reviews");
    const review = {
      id: uuidv4().slice(0, 8),
      category,
      text,
      stars: Math.min(5, Math.max(1, Number(stars))),
    };
    reviews.push(review);
    await writeData("reviews", reviews);
    res.json({ success: true, review });
  })
);

router.delete(
  "/reviews/:id",
  wrap(async (req, res) => {
    let reviews = await readData("reviews");
    reviews = reviews.filter((r) => r.id !== req.params.id);
    await writeData("reviews", reviews);
    res.json({ success: true });
  })
);

// ---------- Gutscheine verwalten ----------
router.get(
  "/coupons",
  wrap(async (req, res) => {
    res.json(await readData("coupons"));
  })
);

router.post(
  "/coupons",
  wrap(async (req, res) => {
    const { code, value } = req.body;
    if (!code || value === undefined) {
      return res.status(400).json({ error: "Code und Wert sind Pflicht." });
    }
    const coupons = await readData("coupons");
    if (coupons.some((c) => c.code.toLowerCase() === code.toLowerCase())) {
      return res.status(400).json({ error: "Gutscheincode existiert bereits." });
    }
    const coupon = { code, value: Number(value), used: false };
    coupons.push(coupon);
    await writeData("coupons", coupons);
    res.json({ success: true, coupon });
  })
);

router.delete(
  "/coupons/:code",
  wrap(async (req, res) => {
    let coupons = await readData("coupons");
    coupons = coupons.filter(
      (c) => c.code.toLowerCase() !== req.params.code.toLowerCase()
    );
    await writeData("coupons", coupons);
    res.json({ success: true });
  })
);

module.exports = router;
