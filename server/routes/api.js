const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { readData, writeData } = require("../db");
const { sendOrderReceivedEmail, sendAdminNewOrderEmail } = require("../email");
const paypal = require("../paypal");

const router = express.Router();

// ---- PayPal Client-ID fürs Frontend bereitstellen ----
router.get("/paypal/client-id", (req, res) => {
  res.json({ clientId: process.env.PAYPAL_CLIENT_ID || "" });
});

// ---- Bewertungen (öffentlich lesbar) ----
router.get("/reviews", async (req, res) => {
  try {
    res.json(await readData("reviews"));
  } catch (e) {
    console.error("Fehler beim Laden der Bewertungen:", e);
    res.status(500).json({ error: "Bewertungen konnten nicht geladen werden." });
  }
});

// ---- Echte Bestellzahl (nur bestätigte/versendete Bestellungen zählen) ----
router.get("/stats/order-count", async (req, res) => {
  try {
    const orders = await readData("orders");
    const count = orders.filter(
      (o) => o.status === "confirmed" || o.status === "shipped"
    ).length;
    res.json({ count });
  } catch (e) {
    console.error("Fehler bei order-count:", e);
    res.status(500).json({ count: 0 });
  }
});

// ---- Bestellverfolgung für Kunden (Bestellnummer + E-Mail erforderlich) ----
router.post("/track", async (req, res) => {
  try {
    const { orderId, email } = req.body;
    if (!orderId || !email) {
      return res.status(400).json({ error: "Bitte Bestellnummer und E-Mail-Adresse angeben." });
    }
    const orders = await readData("orders");
    const order = orders.find(
      (o) =>
        o.id.toLowerCase() === String(orderId).trim().toLowerCase() &&
        o.email.toLowerCase() === String(email).trim().toLowerCase()
    );
    if (!order) {
      return res.status(404).json({ error: "Keine Bestellung mit diesen Angaben gefunden." });
    }
    res.json({
      id: order.id,
      status: order.status,
      items: order.items,
      total: order.total,
      createdAt: order.createdAt,
    });
  } catch (e) {
    console.error("Fehler bei /track:", e);
    res.status(500).json({ error: "Bestellung konnte nicht abgerufen werden." });
  }
});

// ---- Kategorien (öffentlich lesbar) ----
router.get("/categories", async (req, res) => {
  try {
    res.json(await readData("categories"));
  } catch (e) {
    console.error("Fehler beim Laden der Kategorien:", e);
    res.status(500).json({ error: "Kategorien konnten nicht geladen werden." });
  }
});

// ---- Produkte (öffentlich lesbar, nur aktive) ----
router.get("/products", async (req, res) => {
  try {
    const products = (await readData("products")).filter((p) => p.active !== false);
    const { category } = req.query;
    const filtered = category
      ? products.filter((p) => p.category === category)
      : products;
    res.json(filtered);
  } catch (e) {
    console.error("Fehler beim Laden der Produkte:", e);
    res.status(500).json({ error: "Produkte konnten nicht geladen werden." });
  }
});

router.get("/products/:id", async (req, res) => {
  try {
    const products = await readData("products");
    const product = products.find((p) => p.id === req.params.id);
    if (!product) return res.status(404).json({ error: "Produkt nicht gefunden." });
    res.json(product);
  } catch (e) {
    console.error("Fehler beim Laden des Produkts:", e);
    res.status(500).json({ error: "Produkt konnte nicht geladen werden." });
  }
});

// ---- Gutschein prüfen (ohne einzulösen) ----
router.post("/coupons/check", async (req, res) => {
  try {
    const { code } = req.body;
    const coupons = await readData("coupons");
    const coupon = coupons.find(
      (c) => c.code.toLowerCase() === String(code || "").toLowerCase()
    );
    if (!coupon) return res.status(404).json({ error: "Gutschein nicht gefunden." });
    if (coupon.used) return res.status(400).json({ error: "Gutschein wurde bereits verwendet." });
    res.json({ valid: true, value: coupon.value });
  } catch (e) {
    console.error("Fehler bei coupons/check:", e);
    res.status(500).json({ error: "Gutschein konnte nicht geprüft werden." });
  }
});

// ---- Bestellung per Gutschein erstellen (muss vom Admin bestätigt werden) ----
router.post("/orders/coupon", async (req, res) => {
  try {
    const { email, items, couponCode, shipping } = req.body;
    if (!email || !items || !items.length || !couponCode) {
      return res.status(400).json({ error: "Fehlende Angaben." });
    }

    // Der Code wird bewusst NICHT gegen eine Liste geprüft. Er wird
    // einfach übernommen, wie der Kunde ihn eingegeben hat, und im
    // Dashboard angezeigt. Der Admin prüft selbst, ob es "sein" Code
    // ist, bevor er die Bestellung bestätigt.
    const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);

    const order = {
      id: uuidv4().slice(0, 8).toUpperCase(),
      email,
      items,
      shipping: shipping || null,
      total,
      paymentMethod: "coupon",
      couponCode: couponCode,
      status: "pending", // wartet auf manuelle Bestätigung im Dashboard
      createdAt: new Date().toISOString(),
    };

    const orders = await readData("orders");
    orders.push(order);
    await writeData("orders", orders);

    // Sofort antworten, damit der Button beim Kunden nicht hängen bleibt.
    // E-Mails laufen im Hintergrund weiter, auch wenn der Versand langsam ist.
    res.json({ success: true, orderId: order.id });

    sendOrderReceivedEmail(order).catch((e) =>
      console.error("E-Mail-Fehler (Eingangsbestätigung):", e)
    );
    sendAdminNewOrderEmail(order).catch((e) =>
      console.error("E-Mail-Fehler (Admin-Benachrichtigung):", e)
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Serverfehler bei der Bestellung." });
  }
});

// ---- PayPal: Order anlegen ----
router.post("/paypal/create-order", async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !items.length) return res.status(400).json({ error: "Warenkorb ist leer." });
    const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
    const paypalOrder = await paypal.createOrder(total.toFixed(2));
    res.json({ id: paypalOrder.id });
  } catch (e) {
    console.error("PayPal create-order Fehler:", e);
    res.status(500).json({ error: "PayPal-Bestellung konnte nicht erstellt werden." });
  }
});

// ---- PayPal: Zahlung erfassen (capture) + Bestellung speichern ----
router.post("/paypal/capture-order", async (req, res) => {
  try {
    const { paypalOrderId, email, items, shipping } = req.body;
    if (!paypalOrderId || !email || !items || !items.length) {
      return res.status(400).json({ error: "Fehlende Angaben." });
    }

    const capture = await paypal.captureOrder(paypalOrderId);
    const captureStatus = capture.status; // "COMPLETED" bei Erfolg

    const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);

    const order = {
      id: uuidv4().slice(0, 8).toUpperCase(),
      email,
      items,
      shipping: shipping || null,
      total,
      paymentMethod: "paypal",
      paypalOrderId,
      status: captureStatus === "COMPLETED" ? "confirmed" : "pending",
      createdAt: new Date().toISOString(),
    };

    const orders = await readData("orders");
    orders.push(order);
    await writeData("orders", orders);

    // Sofort antworten, E-Mails laufen im Hintergrund weiter.
    res.json({ success: true, orderId: order.id, status: order.status });

    sendOrderReceivedEmail(order).catch((e) =>
      console.error("E-Mail-Fehler (Eingangsbestätigung):", e)
    );
    sendAdminNewOrderEmail(order).catch((e) =>
      console.error("E-Mail-Fehler (Admin-Benachrichtigung):", e)
    );
  } catch (e) {
    console.error("PayPal capture-order Fehler:", e);
    res.status(500).json({ error: "Zahlung konnte nicht bestätigt werden." });
  }
});

module.exports = router;
