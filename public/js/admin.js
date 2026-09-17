let pendingImages = []; // Bild-URLs für das gerade bearbeitete Produkt

// ---------- Login ----------
async function checkLogin() {
  const res = await fetch("/api/admin/me");
  const data = await res.json();
  if (data.isAdmin) {
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("dashboard").style.display = "grid";
    initDashboard();
  } else {
    document.getElementById("login-screen").style.display = "flex";
    document.getElementById("dashboard").style.display = "none";
  }
}

async function login(e) {
  e.preventDefault();
  const username = document.getElementById("login-username").value;
  const password = document.getElementById("login-password").value;
  const res = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (data.success) {
    checkLogin();
  } else {
    document.getElementById("login-error").textContent =
      data.error || "Login fehlgeschlagen.";
  }
}

async function logout() {
  await fetch("/api/admin/logout", { method: "POST" });
  checkLogin();
}

function showSection(name) {
  document
    .querySelectorAll(".admin-section")
    .forEach((s) => s.classList.remove("active"));
  document
    .querySelectorAll(".admin-nav-item")
    .forEach((n) => n.classList.remove("active"));
  document.getElementById(`section-${name}`).classList.add("active");
  document.getElementById(`nav-${name}`).classList.add("active");
}

function initDashboard() {
  loadCategoriesAdmin();
  loadProductsAdmin();
  loadOrdersAdmin();
  loadCouponsAdmin();
  loadReviewsAdmin();
}

// ---------- Kategorien ----------
async function loadCategoriesAdmin() {
  const res = await fetch("/api/admin/categories");
  const categories = await res.json();

  const list = document.getElementById("categories-list");
  list.innerHTML = categories
    .map(
      (c) => `
    <tr>
      <td>${c.name}</td>
      <td>${c.id}</td>
      <td><button class="btn btn-outline btn-small" onclick="deleteCategory('${c.id}')">Löschen</button></td>
    </tr>`
    )
    .join("");

  // Auch das Kategorie-Dropdown im Produktformular befüllen
  const select = document.getElementById("product-category");
  select.innerHTML = categories
    .map((c) => `<option value="${c.id}">${c.name}</option>`)
    .join("");
}

async function addCategory(e) {
  e.preventDefault();
  const name = document.getElementById("new-category-name").value.trim();
  if (!name) return;
  const res = await fetch("/api/admin/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const data = await res.json();
  if (data.success) {
    document.getElementById("new-category-name").value = "";
    loadCategoriesAdmin();
  } else {
    alert(data.error);
  }
}

async function deleteCategory(id) {
  if (!confirm("Kategorie wirklich löschen?")) return;
  await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
  loadCategoriesAdmin();
}

// ---------- Produkte ----------
async function loadProductsAdmin() {
  const res = await fetch("/api/admin/products");
  const products = await res.json();
  const list = document.getElementById("products-list");
  list.innerHTML = products
    .map(
      (p) => `
    <tr>
      <td>${
        p.images && p.images[0]
          ? `<img src="${p.images[0]}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;">`
          : "–"
      }</td>
      <td>${p.title}</td>
      <td>${p.category}</td>
      <td>${p.price.toFixed(2)} €</td>
      <td>${p.active !== false ? "Aktiv" : "Inaktiv"}</td>
      <td>
        <button class="btn btn-outline btn-small" onclick="editProduct('${p.id}')">Bearbeiten</button>
        <button class="btn btn-outline btn-small" onclick="deleteProduct('${p.id}')">Löschen</button>
      </td>
    </tr>`
    )
    .join("");
}

function resetProductForm() {
  document.getElementById("product-form").reset();
  document.getElementById("product-id").value = "";
  pendingImages = [];
  renderImageThumbs();
}

async function editProduct(id) {
  const res = await fetch("/api/admin/products");
  const products = await res.json();
  const product = products.find((p) => p.id === id);
  if (!product) return;
  document.getElementById("product-id").value = product.id;
  document.getElementById("product-title").value = product.title;
  document.getElementById("product-description").value = product.description;
  document.getElementById("product-price").value = product.price;
  document.getElementById("product-category").value = product.category;
  document.getElementById("product-active").checked = product.active !== false;
  pendingImages = product.images || [];
  renderImageThumbs();
  window.scrollTo(0, 0);
}

async function deleteProduct(id) {
  if (!confirm("Produkt wirklich löschen?")) return;
  await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
  loadProductsAdmin();
}

async function saveProduct(e) {
  e.preventDefault();
  const id = document.getElementById("product-id").value;
  const body = {
    title: document.getElementById("product-title").value,
    description: document.getElementById("product-description").value,
    price: document.getElementById("product-price").value,
    category: document.getElementById("product-category").value,
    active: document.getElementById("product-active").checked,
    images: pendingImages,
  };

  const url = id ? `/api/admin/products/${id}` : "/api/admin/products";
  const method = id ? "PUT" : "POST";

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.success) {
    resetProductForm();
    loadProductsAdmin();
  } else {
    alert(data.error);
  }
}

// ---------- Bild-Upload ----------
function renderImageThumbs() {
  const container = document.getElementById("image-thumbs");
  container.innerHTML = pendingImages
    .map(
      (url, idx) => `
    <div class="image-thumb">
      <img src="${url}">
      <button type="button" onclick="removeImage(${idx})">×</button>
    </div>`
    )
    .join("");
}

function removeImage(idx) {
  pendingImages.splice(idx, 1);
  renderImageThumbs();
}

async function uploadImage(e) {
  const file = e.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch("/api/admin/upload", {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  if (data.success) {
    pendingImages.push(data.url);
    renderImageThumbs();
  } else {
    alert(data.error || "Upload fehlgeschlagen.");
  }
  e.target.value = "";
}

// ---------- Bestellungen ----------
let allOrders = [];

async function loadOrdersAdmin() {
  const res = await fetch("/api/admin/orders");
  allOrders = await res.json();
  renderOrdersTable(allOrders);
}

function filterOrders() {
  const query = document.getElementById("order-search").value.trim().toLowerCase();
  if (!query) {
    renderOrdersTable(allOrders);
    return;
  }
  const filtered = allOrders.filter(
    (o) =>
      o.id.toLowerCase().includes(query) ||
      o.email.toLowerCase().includes(query)
  );
  renderOrdersTable(filtered);
}

function renderOrdersTable(orders) {
  const list = document.getElementById("orders-list");

  const badgeClass = { pending: "badge-pending", confirmed: "badge-confirmed", shipped: "badge-shipped" };
  const badgeText = { pending: "Ausstehend", confirmed: "Bestätigt", shipped: "Versendet" };

  if (!orders.length) {
    list.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#6b6b6b;">Keine Bestellungen gefunden.</td></tr>`;
    return;
  }

  list.innerHTML = orders
    .map(
      (o) => `
    <tr>
      <td>${o.id}</td>
      <td>${o.email}</td>
      <td>${o.items.map((i) => `${i.title} (${i.qty}x)`).join(", ")}</td>
      <td>${o.total.toFixed(2)} €</td>
      <td>${o.paymentMethod === "paypal" ? "PayPal" : `Gutschein (${o.couponCode || ""})`}</td>
      <td><span class="badge ${badgeClass[o.status] || ""}">${badgeText[o.status] || o.status}</span></td>
      <td>${new Date(o.createdAt).toLocaleString("de-DE")}</td>
      <td>
        ${
          o.status === "pending"
            ? `<button class="btn btn-small" onclick="confirmOrder('${o.id}')">Bestätigen</button>`
            : ""
        }
        ${
          o.status === "confirmed"
            ? `<button class="btn btn-outline btn-small" onclick="shipOrder('${o.id}')">Als versendet markieren</button>`
            : ""
        }
      </td>
    </tr>`
    )
    .join("");
}

async function confirmOrder(id) {
  await fetch(`/api/admin/orders/${id}/confirm`, { method: "POST" });
  loadOrdersAdmin();
}

async function shipOrder(id) {
  await fetch(`/api/admin/orders/${id}/ship`, { method: "POST" });
  loadOrdersAdmin();
}

// ---------- Gutscheine ----------
async function loadCouponsAdmin() {
  const res = await fetch("/api/admin/coupons");
  const coupons = await res.json();
  const list = document.getElementById("coupons-list");
  list.innerHTML = coupons
    .map(
      (c) => `
    <tr>
      <td>${c.code}</td>
      <td>${c.value.toFixed(2)} €</td>
      <td>${c.used ? "Eingelöst" : "Verfügbar"}</td>
      <td><button class="btn btn-outline btn-small" onclick="deleteCoupon('${c.code}')">Löschen</button></td>
    </tr>`
    )
    .join("");
}

async function addCoupon(e) {
  e.preventDefault();
  const code = document.getElementById("new-coupon-code").value.trim();
  const value = document.getElementById("new-coupon-value").value;
  const res = await fetch("/api/admin/coupons", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, value }),
  });
  const data = await res.json();
  if (data.success) {
    document.getElementById("new-coupon-code").value = "";
    document.getElementById("new-coupon-value").value = "";
    loadCouponsAdmin();
  } else {
    alert(data.error);
  }
}

async function deleteCoupon(code) {
  if (!confirm("Gutschein wirklich löschen?")) return;
  await fetch(`/api/admin/coupons/${code}`, { method: "DELETE" });
  loadCouponsAdmin();
}

document.addEventListener("DOMContentLoaded", checkLogin);

// ---------- Bewertungen ----------
async function loadReviewsAdmin() {
  const res = await fetch("/api/admin/reviews");
  const reviews = await res.json();
  const list = document.getElementById("reviews-list");
  list.innerHTML = reviews
    .map(
      (r) => `
    <tr>
      <td>${r.category}</td>
      <td>${r.text}</td>
      <td>${"★".repeat(r.stars)}${"☆".repeat(5 - r.stars)}</td>
      <td><button class="btn btn-outline btn-small" onclick="deleteReview('${r.id}')">Löschen</button></td>
    </tr>`
    )
    .join("");
}

async function addReview(e) {
  e.preventDefault();
  const category = document.getElementById("new-review-category").value.trim();
  const text = document.getElementById("new-review-text").value.trim();
  const stars = document.getElementById("new-review-stars").value;
  const res = await fetch("/api/admin/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, text, stars }),
  });
  const data = await res.json();
  if (data.success) {
    document.getElementById("new-review-category").value = "";
    document.getElementById("new-review-text").value = "";
    document.getElementById("new-review-stars").value = 5;
    loadReviewsAdmin();
  } else {
    alert(data.error);
  }
}

async function deleteReview(id) {
  if (!confirm("Bewertung wirklich löschen?")) return;
  await fetch(`/api/admin/reviews/${id}`, { method: "DELETE" });
  loadReviewsAdmin();
}
