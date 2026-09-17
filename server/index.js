require("dotenv").config();
const express = require("express");
const session = require("express-session");
const cors = require("cors");
const path = require("path");

const apiRoutes = require("./routes/api");
const adminRoutes = require("./routes/admin");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "bitte-in-.env-aendern",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 8, // 8 Stunden
      httpOnly: true,
    },
  })
);

// Statische Dateien (Frontend)
app.use(express.static(path.join(__dirname, "..", "public")));

// API-Routen
app.use("/api", apiRoutes);
app.use("/api/admin", adminRoutes);

// Health-Check (nützlich für Render)
app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Shop läuft auf Port ${PORT}`);
});
