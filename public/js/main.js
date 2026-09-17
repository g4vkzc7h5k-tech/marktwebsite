// ---------- Warenkorb-Hilfsfunktionen (localStorage) ----------
function getCart() {
  try {
    return JSON.parse(localStorage.getItem("cart") || "[]");
  } catch (e) {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartCount();
}

function addToCart(product, qty = 1) {
  const cart = getCart();
  const existing = cart.find((i) => i.id === product.id);
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({
      id: product.id,
      title: product.title,
      price: product.price,
      image: product.images && product.images[0] ? product.images[0] : null,
      qty,
    });
  }
  saveCart(cart);
}

function updateCartCount() {
  const el = document.getElementById("cart-count");
  if (!el) return;
  const cart = getCart();
  const count = cart.reduce((sum, i) => sum + i.qty, 0);
  el.textContent = count > 0 ? count : "";
}

document.addEventListener("DOMContentLoaded", updateCartCount);
