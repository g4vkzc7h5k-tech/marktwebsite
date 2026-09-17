const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");

function filePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

function readData(name) {
  const p = filePath(name);
  if (!fs.existsSync(p)) return [];
  const raw = fs.readFileSync(p, "utf-8");
  try {
    return JSON.parse(raw || "[]");
  } catch (e) {
    console.error(`Fehler beim Lesen von ${name}.json:`, e);
    return [];
  }
}

function writeData(name, data) {
  const p = filePath(name);
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf-8");
}

module.exports = { readData, writeData };
