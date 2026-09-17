const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { readData, writeData } = require("../db");
const { sendOrderReceivedEmail } = require("../email");
const paypal = require("../paypal");

const router = express.Router();

// ---- PayPal Client-ID fürs Frontend bereitstellen ----
router.get("/paypal/client-id", (req, res) => {
  res.json({ clientId: process.env.PAYPAL_CLIENT_ID || "" });
});

// ---- Kategorien (öffentlich lesbar) ----
router.get("/categories", (req, res) => {
  res.json(readData("categories"));
});

// ---- Produkte (öffentlich lesbar, nur aktive) ----
router.get("/products", (req, res) => {
  const products = readData("products").filter((p) => p.active !== false);
  const { category } = req.query;
  const filtered = category
    ? products.filter((p) => p.category === category)
    : products;
  res.json(filtered);
});

router.get("/products/:id", (req, res) => {
  const products = readData("products");
  const product = products.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: "Produkt nicht gefunden." });
  res.json(product);
});

// ---- Gutschein prüfen (ohne einzulösen) ----
router.post("/coupons/check", (req, res) => {
  const { code } = req.body;
  const coupons = readData("coupons");
  const coupon = coupons.find(
    (c) => c.code.toLowerCase() === String(code || "").toLowerCase()
  );
  if (!coupon) return res.status(404).json({ error: "Gutschein nicht gefunden." });
  if (coupon.used) return res.status(400).json({ error: "Gutschein wurde bereits verwendet." });
  res.json({ valid: true, value: coupon.value });
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

    const orders = readData("orders");
    orders.push(order);
    writeData("orders", orders);

    await sendOrderReceivedEmail(order).catch((e) =>
      console.error("E-Mail-Fehler (Eingangsbestätigung):", e)
    );

    res.json({ success: true, orderId: order.id });
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

    const orders = readData("orders");
    orders.push(order);
    writeData("orders", orders);

    await sendOrderReceivedEmail(order).catch((e) =>
      console.error("E-Mail-Fehler (Eingangsbestätigung):", e)
    );

    res.json({ success: true, orderId: order.id, status: order.status });
  } catch (e) {
    console.error("PayPal capture-order Fehler:", e);
    res.status(500).json({ error: "Zahlung konnte nicht bestätigt werden." });
  }
});

module.exports = router;
