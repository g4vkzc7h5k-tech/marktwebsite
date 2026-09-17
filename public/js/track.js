const STEP_ORDER = ["pending", "confirmed", "preparing", "shipped", "delivered"];

function showTrackMessage(text, type = "error") {
  const box = document.getElementById("message-box");
  box.textContent = text;
  box.className = `message-box ${type}`;
  box.style.display = "block";
}

async function trackOrder(e) {
  e.preventDefault();
  const orderId = document.getElementById("track-order-id").value.trim();
  const email = document.getElementById("track-email").value.trim();

  const res = await fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, email }),
  });
  const data = await res.json();

  if (!res.ok) {
    document.getElementById("tracking-result").style.display = "none";
    showTrackMessage(data.error || "Bestellung konnte nicht gefunden werden.", "error");
    return;
  }

  document.getElementById("message-box").style.display = "none";
  renderTracking(data);
}

function renderTracking(order) {
  const currentIndex = STEP_ORDER.indexOf(order.status);

  document.querySelectorAll(".tracker-step").forEach((stepEl) => {
    const step = stepEl.dataset.step;
    const stepIndex = STEP_ORDER.indexOf(step);
    stepEl.classList.remove("done", "current");
    if (stepIndex < currentIndex) {
      stepEl.classList.add("done");
    } else if (stepIndex === currentIndex) {
      stepEl.classList.add("done", "current");
    }
  });

  document.getElementById("tracking-items").innerHTML = order.items
    .map(
      (i) => `
    <div class="summary-row">
      <span>${i.title} (${i.qty}x)</span>
      <span>${(i.price * i.qty).toFixed(2)} €</span>
    </div>`
    )
    .join("");

  document.getElementById("tracking-total").textContent = `${order.total.toFixed(2)} €`;
  document.getElementById("tracking-result").style.display = "block";
}
