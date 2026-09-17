let paymentMethod = "paypal";
let paypalButtonsRendered = false;

function renderCart() {
  const cart = getCart();
  const container = document.getElementById("cart-items");
  const summary = document.getElementById("cart-summary");

  if (!cart.length) {
    container.innerHTML = `<div class="empty-state">Dein Warenkorb ist leer. <a href="/shop.html">Jetzt stöbern →</a></div>`;
    summary.style.display = "none";
    return;
  }
  summary.style.display = "block";

  container.innerHTML = cart
    .map(
      (item, idx) => `
    <div class="cart-item">
      ${
        item.image
          ? `<img src="${item.image}" alt="${item.title}">`
          : `<div style="width:70px;height:70px;background:#f0eee9;border-radius:8px;"></div>`
      }
      <div class="cart-item-info">
        <div style="font-weight:600;">${item.title}</div>
        <div style="color:#6b6b6b;font-size:13px;">${item.price.toFixed(2)} € / Stück</div>
        <div class="cart-item-qty">
          <button class="qty-btn" onclick="changeQty(${idx}, -1)">−</button>
          <span>${item.qty}</span>
          <button class="qty-btn" onclick="changeQty(${idx}, 1)">+</button>
          <button class="btn btn-outline btn-small" style="margin-left:12px;" onclick="removeItem(${idx})">Entfernen</button>
        </div>
      </div>
      <div style="font-weight:700;">${(item.price * item.qty).toFixed(2)} €</div>
    </div>`
    )
    .join("");

  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  document.getElementById("summary-total").textContent = `${total.toFixed(2)} €`;
}

function changeQty(idx, delta) {
  const cart = getCart();
  cart[idx].qty += delta;
  if (cart[idx].qty <= 0) cart.splice(idx, 1);
  saveCart(cart);
  renderCart();
  if (paymentMethod === "paypal") renderPaypalButtons();
}

function removeItem(idx) {
  const cart = getCart();
  cart.splice(idx, 1);
  saveCart(cart);
  renderCart();
  if (paymentMethod === "paypal") renderPaypalButtons();
}

function selectPaymentMethod(method) {
  paymentMethod = method;
  document
    .querySelectorAll(".payment-tab")
    .forEach((t) => t.classList.remove("active"));
  document.getElementById(`tab-${method}`).classList.add("active");
  document.getElementById("paypal-section").style.display =
    method === "paypal" ? "block" : "none";
  document.getElementById("coupon-section").style.display =
    method === "coupon" ? "block" : "none";
  if (method === "paypal") renderPaypalButtons();
}

function showMessage(text, type = "success") {
  const box = document.getElementById("message-box");
  box.textContent = text;
  box.className = `message-box ${type}`;
  box.style.display = "block";
}

function getCheckoutEmail() {
  return document.getElementById("checkout-email").value.trim();
}

function getShippingData() {
  return {
    name: document.getElementById("checkout-name").value.trim(),
    address: document.getElementById("checkout-address").value.trim(),
  };
}

function validateCheckoutForm() {
  const email = getCheckoutEmail();
  if (!email || !email.includes("@")) {
    showMessage("Bitte gib eine gültige E-Mail-Adresse ein.", "error");
    return false;
  }
  if (!getCart().length) {
    showMessage("Dein Warenkorb ist leer.", "error");
    return false;
  }
  return true;
}

// ---------- PayPal ----------
function renderPaypalButtons() {
  const container = document.getElementById("paypal-buttons");
  container.innerHTML = "";
  if (typeof paypal === "undefined") {
    container.innerHTML =
      '<p style="color:#b02a2a;font-size:13px;">PayPal konnte nicht geladen werden. Bitte PayPal Client-ID in der .env prüfen.</p>';
    return;
  }

  window.paypal
    .Buttons({
      createOrder: async () => {
        if (!validateCheckoutForm()) throw new Error("invalid-form");
        const res = await fetch("/api/paypal/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: getCart() }),
        });
        const data = await res.json();
        if (!data.id) throw new Error("PayPal-Order konnte nicht erstellt werden.");
        return data.id;
      },
      onApprove: async (data) => {
        const res = await fetch("/api/paypal/capture-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paypalOrderId: data.orderID,
            email: getCheckoutEmail(),
            items: getCart(),
            shipping: getShippingData(),
          }),
        });
        const result = await res.json();
        if (result.success) {
          localStorage.removeItem("cart");
          updateCartCount();
          showMessage(
            `Zahlung erfolgreich! Deine Bestellnummer lautet ${result.orderId}. Du erhältst gleich eine Bestätigungs-E-Mail.`,
            "success"
          );
          document.getElementById("cart-items").innerHTML = "";
          document.getElementById("cart-summary").style.display = "none";
        } else {
          showMessage(result.error || "Zahlung konnte nicht verarbeitet werden.", "error");
        }
      },
      onError: () => {
        showMessage("Bei der PayPal-Zahlung ist ein Fehler aufgetreten.", "error");
      },
    })
    .render("#paypal-buttons");
}

// ---------- Gutschein ----------
async function submitCouponOrder() {
  if (!validateCheckoutForm()) return;
  const code = document.getElementById("coupon-code").value.trim();
  if (!code) {
    showMessage("Bitte gib einen Gutscheincode ein.", "error");
    return;
  }

  const btn = document.querySelector('#coupon-section button.btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Wird gesendet...";
  }

  try {
    const res = await fetch("/api/orders/coupon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: getCheckoutEmail(),
        items: getCart(),
        couponCode: code,
        shipping: getShippingData(),
      }),
    });

    let result;
    try {
      result = await res.json();
    } catch (parseErr) {
      showMessage(
        `Unerwartete Serverantwort (Status ${res.status}). Bitte prüfe die Render-Logs.`,
        "error"
      );
      return;
    }

    if (result.success) {
      localStorage.removeItem("cart");
      updateCartCount();
      showMessage(
        `Bestellung eingegangen! Deine Bestellnummer lautet ${result.orderId}. Wir prüfen deinen Gutschein und bestätigen dir die Bestellung per E-Mail.`,
        "success"
      );
      document.getElementById("cart-items").innerHTML = "";
      document.getElementById("cart-summary").style.display = "none";
    } else {
      showMessage(result.error || "Gutschein konnte nicht eingelöst werden.", "error");
    }
  } catch (networkErr) {
    console.error("Netzwerkfehler beim Senden der Bestellung:", networkErr);
    showMessage(
      "Verbindung zum Server fehlgeschlagen. Bitte Internetverbindung prüfen und erneut versuchen.",
      "error"
    );
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Mit Gutschein bezahlen";
    }
  }
}

async function loadPaypalSdk() {
  const res = await fetch("/api/paypal/client-id");
  const { clientId } = await res.json();
  if (!clientId) return;
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=EUR&disable-funding=card,sepa,sofort,bancontact,giropay,eps,ideal,mybank,p24,blik,venmo,paylater`;
    script.onload = resolve;
    script.onerror = resolve;
    document.head.appendChild(script);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  renderCart();
  if (document.getElementById("paypal-buttons")) {
    await loadPaypalSdk();
    renderPaypalButtons();
  }
});
