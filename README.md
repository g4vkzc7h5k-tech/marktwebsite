# Mein Shop

Ein schlanker Online-Shop mit:
- Startseite mit eigenen Texten
- Shop-Seite mit Kategorie-Filtern
- Warenkorb & Checkout
- Zahlung per **PayPal** oder **Gutscheinkarte** (Gutschein wird manuell im Dashboard bestätigt)
- **Admin-Dashboard** zum Verwalten von Kategorien, Produkten, Bildern, Bestellungen und Gutscheinen
- Automatische E-Mails: **Bestelleingang** (sofort) & **Zahlungsbestätigung** (wenn du sie im Dashboard bestätigst)

---

## 1. Lokal testen

```bash
npm install
cp .env.example .env
```

Öffne `.env` und trage deine echten Zugangsdaten ein (siehe Abschnitt 3–5 unten).
Dann:

```bash
npm start
```

Die Seite läuft dann unter `http://localhost:3000`.
Das Admin-Dashboard erreichst du unter `http://localhost:3000/admin.html`
(Login mit `ADMIN_USER` / `ADMIN_PASSWORD` aus deiner `.env`).

---

## 2. Deployment auf Render (empfohlen)

GitHub Pages kann **nur statische Seiten** hosten – kein Backend, keine Datenbank,
keinen E-Mail-Versand. Da du ein Admin-Dashboard mit echten Bestellungen und
automatischen E-Mails willst, brauchst du einen Server. **Render** ist dafür kostenlos
im Starter-Tarif geeignet.

1. Lade dieses Projekt in ein neues GitHub-Repository hoch (z. B. über GitHub Desktop
   oder `git init && git add . && git commit -m "init" && git push`).
2. Gehe zu [render.com](https://render.com) → **New** → **Web Service**.
3. Verbinde dein GitHub-Repo.
4. Einstellungen:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Unter **Environment** alle Variablen aus `.env.example` eintragen (echte Werte!).
6. Deploy klicken – nach ein paar Minuten ist deine Seite unter einer
   `https://dein-shop.onrender.com`-URL live.

⚠️ **Wichtig zu Render (kostenloser Plan):** Der Dateispeicher auf Render ist nicht
dauerhaft (bei jedem Neustart/Redeploy können hochgeladene Bilder & JSON-Daten
verloren gehen). Für den Start zum Testen reicht das völlig aus. Sobald der Shop
"scharf" laufen soll, empfehle ich:
- Einen **Render Disk** (persistenter Speicher, im bezahlten Plan) anzuhängen, damit
  `server/data/*.json` und `public/images/products/` erhalten bleiben, **oder**
- später auf eine echte Datenbank (z. B. Postgres) + Cloud-Speicher (z. B.
  Cloudinary) umzusteigen.

---

## 2b. Datenbank einrichten (WICHTIG – sonst gehen Daten verloren!)

Render löscht bei jedem Redeploy (also jedem neuen Datei-Upload auf GitHub) den
kompletten Dateispeicher deines Web Service. Ohne eine externe Datenbank
verschwinden dann alle Produkte, Bestellungen, Bewertungen und Gutscheine, die
du im Dashboard eingetragen hast!

Deshalb nutzt dieses Projekt **MongoDB Atlas** (kostenlose Cloud-Datenbank,
für diese Shop-Größe dauerhaft gratis):

1. Gehe zu [mongodb.com/cloud/atlas/register](https://www.mongodb.com/cloud/atlas/register)
   und erstelle ein kostenloses Konto.
2. Erstelle ein neues **kostenloses Cluster** (M0 Free Tier).
3. Unter "Database Access": Lege einen Datenbank-Benutzer mit Passwort an
   (merken oder notieren!).
4. Unter "Network Access": Klicke "Add IP Address" → "Allow Access from
   Anywhere" (0.0.0.0/0) – nötig, damit Render zugreifen kann.
5. Klicke auf "Connect" bei deinem Cluster → "Drivers" → kopiere die
   angezeigte Connection-String-URL (sieht aus wie
   `mongodb+srv://benutzer:<password>@cluster0.xxxxx.mongodb.net/...`).
6. Ersetze `<password>` durch dein echtes Passwort aus Schritt 3.
7. Trage diese komplette URL bei Render als Environment Variable
   `MONGODB_URI` ein.

Danach speichert der Shop alle Daten dauerhaft in der Cloud – auch wenn du
später neue Dateien hochlädst und Render neu deployed, bleiben Produkte,
Bestellungen usw. erhalten.

⚠️ Ohne `MONGODB_URI` läuft der Shop trotzdem (Fallback auf lokale Dateien),
aber dann eben mit dem beschriebenen Datenverlust-Risiko bei jedem Redeploy.

---

## 3. E-Mail-Versand einrichten (SMTP)

Am einfachsten mit einem Gmail-Konto:
1. Gehe in deinem Google-Konto zu **Sicherheit → 2-Faktor-Authentifizierung aktivieren**.
2. Erstelle danach ein **App-Passwort** (Google-Konto → Sicherheit → App-Passwörter).
3. Trage in der `.env` ein:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=deine-email@gmail.com
   SMTP_PASS=das-16-stellige-app-passwort
   FROM_EMAIL="Mein Shop <deine-email@gmail.com>"
   ```

Alternativ kannst du auch einen professionellen Mail-Dienst wie **SendGrid**, **Mailgun**
oder **Brevo** nutzen (bessere Zustellbarkeit für viele Bestellungen).

---

## 4. PayPal einrichten

1. Gehe zu [developer.paypal.com](https://developer.paypal.com) → **Apps & Credentials**.
2. Erstelle zunächst eine **Sandbox**-App zum Testen → du bekommst eine
   `Client ID` und ein `Secret`.
3. Trage beides in `.env` ein:
   ```
   PAYPAL_CLIENT_ID=...
   PAYPAL_CLIENT_SECRET=...
   PAYPAL_MODE=sandbox
   ```
4. Zum Testen: Mit einem PayPal-Sandbox-Testkonto (wird automatisch im Developer-Dashboard
   erstellt) im Checkout bezahlen.
5. **Wenn alles funktioniert:** Lege im PayPal-Dashboard eine **Live**-App an, trage die
   echten Zugangsdaten ein und setze `PAYPAL_MODE=live`.

---

## 5. Admin-Zugang

In der `.env`:
```
ADMIN_USER=admin
ADMIN_PASSWORD=dein-sicheres-passwort
```
Ändere unbedingt das Standardpasswort, bevor du live gehst!
Dashboard erreichbar unter: `https://deine-domain/admin.html`

Im Dashboard kannst du:
- **Kategorien** anlegen, umbenennen, löschen (erscheinen automatisch als Filter im Shop)
- **Produkte** anlegen/bearbeiten/löschen inkl. Bild-Upload direkt über das Formular
- **Bestellungen** einsehen und Gutschein-Zahlungen manuell bestätigen (löst automatisch
  die Bestätigungs-E-Mail an den Kunden aus)
- **Gutscheincodes** erstellen, die Kunden beim Checkout einlösen können

---

## 6. Eigene Texte & Bilder einfügen

- **Startseiten-Text:** Öffne `public/index.html`, die Überschrift und der Text stehen
  klar markiert im `<section class="hero">`-Bereich.
- **Produktbilder & -texte:** Am einfachsten direkt im Admin-Dashboard unter
  "Produkte" – Titel, Beschreibung, Preis und Bilder kannst du dort bequem eintragen/hochladen,
  ohne Code anzufassen.
- Alternativ kannst du auch direkt die Dateien in `server/data/products.json` bzw.
  `server/data/categories.json` bearbeiten und Bilder manuell in
  `public/images/products/` ablegen (Pfad dann z. B. `/images/products/mein-bild.jpg`
  im `images`-Array eintragen).

---

## 7. Projektstruktur

```
shop-website/
├── server/
│   ├── index.js          # Express-Server
│   ├── db.js              # einfache JSON-Datenspeicherung
│   ├── email.js           # E-Mail-Versand & Vorlagen
│   ├── paypal.js          # PayPal-Integration
│   ├── data/               # Kategorien, Produkte, Bestellungen, Gutscheine (JSON)
│   ├── middleware/auth.js  # Admin-Login-Schutz
│   └── routes/
│       ├── api.js          # öffentliche API (Shop, Checkout)
│       └── admin.js        # geschützte Admin-API
├── public/
│   ├── index.html          # Startseite
│   ├── shop.html            # Shop mit Filtern
│   ├── cart.html            # Warenkorb & Checkout
│   ├── admin.html           # Admin-Dashboard
│   ├── css/style.css
│   ├── js/                  # main.js, shop.js, cart.js, admin.js
│   └── images/products/     # hochgeladene Produktbilder
├── package.json
├── .env.example
└── README.md
```

---

## 8. Was hier bewusst nicht enthalten ist

Ein separates Live-Chat-/Ticket-System für die Gutschein-Zahlung wurde durch ein
einfacheres, aber genauso funktionales Modell ersetzt: Kunden geben ihren Gutscheincode
direkt im Checkout ein, die Bestellung landet als "ausstehend" in deinem Dashboard, und
du bestätigst sie dort per Klick – inklusive automatischer Bestätigungs-E-Mail an den
Kunden. Ein echtes Live-Chat-System würde einen dauerhaft laufenden Server mit
WebSockets sowie zusätzliche Infrastruktur benötigen; falls du das später ergänzen
möchtest, lässt sich das nachrüsten.
