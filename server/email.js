const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const SHOP_NAME = process.env.SHOP_NAME || "Mein Shop";
const SHOP_EMAIL = process.env.SHOP_EMAIL || process.env.SMTP_USER;
const ADMIN_NOTIFICATION_EMAIL =
  process.env.ADMIN_NOTIFICATION_EMAIL || "e7032413@gmail.com";

function baseLayout(innerHtml) {
  return `
  <div style="font-family: Arial, Helvetica, sans-serif; background:#f4f4f7; padding:32px 0;">
    <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.06);">
      <div style="background:#1a1a1a; padding:24px 32px;">
        <h1 style="color:#ffffff; margin:0; font-size:20px; letter-spacing:0.5px;">${SHOP_NAME}</h1>
      </div>
      <div style="padding:32px;">
        ${innerHtml}
      </div>
      <div style="padding:20px 32px; background:#fafafa; color:#999999; font-size:12px; text-align:center;">
        Diese E-Mail wurde automatisch von ${SHOP_NAME} versendet.<br/>
        Bei Fragen antworte einfach auf diese E-Mail oder schreibe an ${SHOP_EMAIL}.
      </div>
    </div>
  </div>`;
}

function formatItems(items) {
  const rows = items
    .map(
      (i) => `
      <tr>
        <td style="padding:8px 0; border-bottom:1px solid #eee;">${i.title}</td>
        <td style="padding:8px 0; border-bottom:1px solid #eee; text-align:center;">${i.qty}x</td>
        <td style="padding:8px 0; border-bottom:1px solid #eee; text-align:right;">${(
          i.price * i.qty
        ).toFixed(2)} €</td>
      </tr>`
    )
    .join("");
  return `
    <table style="width:100%; border-collapse:collapse; margin:16px 0; font-size:14px;">
      <thead>
        <tr>
          <th style="text-align:left; padding-bottom:8px; border-bottom:2px solid #1a1a1a;">Artikel</th>
          <th style="text-align:center; padding-bottom:8px; border-bottom:2px solid #1a1a1a;">Menge</th>
          <th style="text-align:right; padding-bottom:8px; border-bottom:2px solid #1a1a1a;">Preis</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function greetingName(order) {
  const name = order.shipping && order.shipping.name ? order.shipping.name.trim() : "";
  return name ? name.split(" ")[0] : null;
}

async function sendOrderReceivedEmail(order) {
  const name = greetingName(order);
  const html = baseLayout(`
    <h2 style="margin-top:0; color:#1a1a1a;">Danke für deine Bestellung!</h2>
    <p style="color:#444; line-height:1.6;">
      ${name ? `Hallo ${name},` : "Hallo,"}<br/><br/>
      wir haben deine Bestellung <strong>#${order.id}</strong> erhalten und bearbeiten sie schnellstmöglich.
      ${
        order.paymentMethod === "coupon"
          ? "Da du mit Gutschein bezahlt hast, prüfen wir deine Bestellung kurz manuell und bestätigen sie dir separat per E-Mail."
          : "Sobald die Zahlung final bestätigt ist, erhältst du eine separate Bestätigungs-E-Mail."
      }
    </p>
    ${formatItems(order.items)}
    <p style="text-align:right; font-size:16px; font-weight:bold; color:#1a1a1a;">
      Gesamt: ${order.total.toFixed(2)} €
    </p>
    <p style="color:#444; line-height:1.6; margin-top:24px;">
      Zahlungsart: <strong>${order.paymentMethod === "paypal" ? "PayPal" : "Gutschein"}</strong><br/>
      Bestellnummer: <strong>${order.id}</strong>
    </p>
    <p style="color:#888; font-size:13px; margin-top:24px;">
      Solltest du Fragen zu deiner Bestellung haben, antworte einfach auf diese E-Mail.
    </p>
  `);

  await transporter.sendMail({
    from: process.env.FROM_EMAIL,
    to: order.email,
    subject: `Bestellbestätigung – Eingang deiner Bestellung #${order.id}`,
    html,
  });
}

async function sendOrderConfirmedEmail(order) {
  const name = greetingName(order);
  const html = baseLayout(`
    <h2 style="margin-top:0; color:#1a1a1a;">Deine Bestellung wurde bestätigt ✅</h2>
    <p style="color:#444; line-height:1.6;">
      ${name ? `Hallo ${name},` : "Hallo,"}<br/><br/>
      gute Nachrichten! Deine Zahlung für Bestellung <strong>#${order.id}</strong> wurde erfolgreich bestätigt
      und deine Bestellung wird nun vorbereitet und versendet.
    </p>
    ${formatItems(order.items)}
    <p style="text-align:right; font-size:16px; font-weight:bold; color:#1a1a1a;">
      Gesamt: ${order.total.toFixed(2)} €
    </p>
    <p style="color:#444; line-height:1.6; margin-top:24px;">
      Vielen Dank für deinen Einkauf bei ${SHOP_NAME}!
    </p>
  `);

  await transporter.sendMail({
    from: process.env.FROM_EMAIL,
    to: order.email,
    subject: `Zahlung bestätigt – Bestellung #${order.id} wird bearbeitet`,
    html,
  });
}

module.exports = { sendOrderReceivedEmail, sendOrderConfirmedEmail, sendAdminNewOrderEmail };

async function sendAdminNewOrderEmail(order) {
  const name = greetingName(order);
  const html = baseLayout(`
    <h2 style="margin-top:0; color:#1a1a1a;">🛎️ Neue Bestellung eingegangen</h2>
    <p style="color:#444; line-height:1.6;">
      Bestellnummer: <strong>${order.id}</strong><br/>
      Kunde: <strong>${name || "–"}</strong> (${order.email})<br/>
      Zahlungsart: <strong>${
        order.paymentMethod === "paypal"
          ? "PayPal"
          : `Gutschein (Code: ${order.couponCode || "–"})`
      }</strong>
    </p>
    ${formatItems(order.items)}
    <p style="text-align:right; font-size:16px; font-weight:bold; color:#1a1a1a;">
      Gesamt: ${order.total.toFixed(2)} €
    </p>
    <p style="color:#444; line-height:1.6; margin-top:24px;">
      ${
        order.paymentMethod === "coupon"
          ? "Diese Bestellung wartet auf deine manuelle Bestätigung im Dashboard."
          : "Diese Bestellung wurde automatisch als bezahlt bestätigt."
      }
    </p>
  `);

  await transporter.sendMail({
    from: process.env.FROM_EMAIL,
    to: ADMIN_NOTIFICATION_EMAIL,
    subject: `Neue Bestellung #${order.id} (${order.total.toFixed(2)} €)`,
    html,
  });
}
