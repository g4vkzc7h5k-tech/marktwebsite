const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");

const uri = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || "shop";
const COLLECTION = "data";

let clientPromise = null;

function getClient() {
  if (!clientPromise) {
    const client = new MongoClient(uri);
    clientPromise = client.connect();
  }
  return clientPromise;
}

// Fallback: lokale JSON-Dateien, NUR falls noch keine MONGODB_URI gesetzt ist
// (z. B. beim ersten lokalen Testen, bevor die Datenbank eingerichtet ist).
// Auf Render ohne MONGODB_URI gehen Daten bei jedem Redeploy wieder verloren!
const DATA_DIR = path.join(__dirname, "data");
function localFilePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}
function localRead(name) {
  const p = localFilePath(name);
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8") || "[]");
  } catch (e) {
    return [];
  }
}
function localWrite(name, data) {
  fs.writeFileSync(localFilePath(name), JSON.stringify(data, null, 2), "utf-8");
}

// name = z.B. "products", "categories", "orders", "coupons", "reviews"
// Jede "Tabelle" wird in MongoDB als EIN Dokument mit einem Array-Feld "items" gespeichert.
async function readData(name) {
  if (!uri) return localRead(name);
  const client = await getClient();
  const db = client.db(DB_NAME);
  const doc = await db.collection(COLLECTION).findOne({ _id: name });
  return doc ? doc.items : [];
}

async function writeData(name, items) {
  if (!uri) return localWrite(name, items);
  const client = await getClient();
  const db = client.db(DB_NAME);
  await db
    .collection(COLLECTION)
    .updateOne({ _id: name }, { $set: { items } }, { upsert: true });
}

module.exports = { readData, writeData };
