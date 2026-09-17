let allProducts = [];
let activeCategory = null;

async function loadCategories() {
  const res = await fetch("/api/categories");
  const categories = await res.json();
  const container = document.getElementById("category-filters");
  container.innerHTML = "";

  const allBtn = document.createElement("button");
  allBtn.className = "filter-option active";
  allBtn.textContent = "Alle Produkte";
  allBtn.onclick = () => selectCategory(null, allBtn);
  container.appendChild(allBtn);

  categories.forEach((cat) => {
    const btn = document.createElement("button");
    btn.className = "filter-option";
    btn.textContent = cat.name;
    btn.onclick = () => selectCategory(cat.id, btn);
    container.appendChild(btn);
  });
}

function selectCategory(categoryId, btnEl) {
  activeCategory = categoryId;
  document
    .querySelectorAll(".filter-option")
    .forEach((b) => b.classList.remove("active"));
  btnEl.classList.add("active");
  renderProducts();
}

async function loadProducts() {
  const res = await fetch("/api/products");
  allProducts = await res.json();
  renderProducts();
}

function renderProducts() {
  const grid = document.getElementById("product-grid");
  const filtered = activeCategory
    ? allProducts.filter((p) => p.category === activeCategory)
    : allProducts;

  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state">Aktuell keine Produkte in dieser Kategorie.</div>`;
    return;
  }

  grid.innerHTML = filtered
    .map(
      (p) => `
      <div class="product-card">
        <div class="product-image">
          ${
            p.images && p.images[0]
              ? `<img src="${p.images[0]}" alt="${p.title}">`
              : `<span class="placeholder">Kein Bild</span>`
          }
        </div>
        <div class="product-info">
          <div class="product-title">${p.title}</div>
          <div class="product-desc">${p.description || ""}</div>
          <div class="product-price">${p.price.toFixed(2)} €</div>
          <button class="btn btn-small" onclick='addToCartFromGrid("${p.id}")'>In den Warenkorb</button>
        </div>
      </div>`
    )
    .join("");
}

function addToCartFromGrid(productId) {
  const product = allProducts.find((p) => p.id === productId);
  if (!product) return;
  addToCart(product, 1);
}

document.addEventListener("DOMContentLoaded", () => {
  loadCategories();
  loadProducts();
});
