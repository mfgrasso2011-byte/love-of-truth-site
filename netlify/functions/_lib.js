const crypto = require("crypto");
const { URLSearchParams } = require("url");

const BOOKS = {
  "sailing-to-chayah": {
    name: "Sailing to Chayah: A Desperate Journey",
    formats: {
      Hardcover: { amount: 2099, requiresShipping: true, taxCode: "txcd_99999999" },
      Paperback: { amount: 1499, requiresShipping: true, taxCode: "txcd_99999999" },
      EBook: { amount: 499, requiresShipping: false, taxCode: "txcd_10302000" },
    },
  },
};

const SHIPPING_RATE_UNDER_THRESHOLD = 599;
const FREE_SHIPPING_THRESHOLD = 4000;

function getConfig() {
  const domain =
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    process.env.DOMAIN ||
    "http://localhost:3000";

  return {
    domain,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
    resendApiKey: process.env.RESEND_API_KEY || "",
    orderFromEmail: process.env.ORDER_FROM_EMAIL || "",
    adminNotifyEmail: process.env.ADMIN_NOTIFY_EMAIL || "",
    enableStripeTax: String(process.env.ENABLE_STRIPE_TAX || "true") === "true",
    shippingCountries: (process.env.SHIPPING_COUNTRIES || "US")
      .split(",")
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean),
  };
}

function response(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(payload),
  };
}

function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Cart is empty.");
  }

  return items.map((item) => {
    const book = BOOKS[item.productId];
    if (!book) {
      throw new Error("Invalid product.");
    }

    const format = book.formats[item.format];
    if (!format) {
      throw new Error("Invalid format.");
    }

    const quantity = Math.max(1, Math.min(99, Number(item.quantity || 1)));
    return {
      quantity,
      requiresShipping: format.requiresShipping,
      name: `${book.name} (${item.format})`,
      taxCode: format.taxCode,
      unitAmount: format.amount,
    };
  });
}

function buildStripeForm(items, config) {
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", `${config.domain}/success.html?session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${config.domain}/cancel.html`);

  if (config.enableStripeTax) {
    params.set("automatic_tax[enabled]", "true");
    params.set("billing_address_collection", "required");
  }

  const needsShipping = items.some((item) => item.requiresShipping);
  const physicalSubtotal = items.reduce(
    (sum, item) => sum + (item.requiresShipping ? item.unitAmount * item.quantity : 0),
    0
  );

  if (needsShipping) {
    config.shippingCountries.forEach((country, index) => {
      params.set(`shipping_address_collection[allowed_countries][${index}]`, country);
    });

    const shippingAmount =
      physicalSubtotal < FREE_SHIPPING_THRESHOLD ? SHIPPING_RATE_UNDER_THRESHOLD : 0;
    const shippingName =
      shippingAmount > 0 ? "Standard shipping" : "Free shipping";

    params.set("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
    params.set(
      "shipping_options[0][shipping_rate_data][fixed_amount][amount]",
      String(shippingAmount)
    );
    params.set("shipping_options[0][shipping_rate_data][fixed_amount][currency]", "usd");
    params.set("shipping_options[0][shipping_rate_data][display_name]", shippingName);

    if (config.enableStripeTax) {
      params.set("shipping_options[0][shipping_rate_data][tax_behavior]", "exclusive");
      params.set("shipping_options[0][shipping_rate_data][tax_code]", "txcd_92010001");
    }
  }

  items.forEach((item, index) => {
    params.set(`line_items[${index}][quantity]`, String(item.quantity));
    params.set(`line_items[${index}][price_data][currency]`, "usd");
    params.set(`line_items[${index}][price_data][unit_amount]`, String(item.unitAmount));
    if (config.enableStripeTax) {
      params.set(`line_items[${index}][price_data][tax_behavior]`, "exclusive");
      params.set(`line_items[${index}][price_data][product_data][tax_code]`, item.taxCode);
    }
    params.set(`line_items[${index}][price_data][product_data][name]`, item.name);
  });

  return params;
}

async function createCheckoutSession(items, config) {
  if (!config.stripeSecretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY on the server.");
  }

  const form = buildStripeForm(items, config);
  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  const data = await stripeResponse.json();
  if (!stripeResponse.ok) {
    throw new Error(data?.error?.message || "Stripe Checkout session creation failed.");
  }

  return data;
}

function verifyStripeSignature(rawBody, signatureHeader, webhookSecret) {
  if (!webhookSecret) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET on the server.");
  }

  if (!signatureHeader) {
    throw new Error("Missing Stripe-Signature header.");
  }

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((segment) => {
      const [key, value] = segment.split("=");
      return [key, value];
    })
  );

  const timestamp = parts.t;
  const signature = parts.v1;

  if (!timestamp || !signature) {
    throw new Error("Invalid Stripe-Signature header.");
  }

  const payload = `${timestamp}.${rawBody}`;
  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(payload, "utf8")
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");

  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    throw new Error("Stripe webhook signature verification failed.");
  }
}

function recordCompletedOrder(session) {
  return {
    receivedAt: new Date().toISOString(),
    sessionId: session.id,
    customerEmail: session.customer_details?.email || null,
    customerName: session.customer_details?.name || null,
    amountTotal: session.amount_total,
    currency: session.currency,
    shippingDetails: session.shipping_details || null,
  };
}

async function sendAdminOrderEmail(order, config) {
  if (!config.resendApiKey || !config.orderFromEmail || !config.adminNotifyEmail) {
    console.log("Order email skipped: missing Resend configuration.");
    return;
  }

  const shipping = order.shippingDetails?.address
    ? [
        order.shippingDetails.name,
        order.shippingDetails.address.line1,
        order.shippingDetails.address.line2,
        `${order.shippingDetails.address.city || ""}, ${order.shippingDetails.address.state || ""} ${order.shippingDetails.address.postal_code || ""}`.trim(),
        order.shippingDetails.address.country,
      ]
        .filter(Boolean)
        .join("<br />")
    : "No shipping details provided.";

  const amount =
    typeof order.amountTotal === "number" ? (order.amountTotal / 100).toFixed(2) : "0.00";

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.orderFromEmail,
      to: [config.adminNotifyEmail],
      subject: `New Love of Truth order: ${order.sessionId}`,
      html: `
        <h1>New Order Received</h1>
        <p><strong>Session ID:</strong> ${order.sessionId}</p>
        <p><strong>Customer:</strong> ${order.customerName || "Unknown"}</p>
        <p><strong>Email:</strong> ${order.customerEmail || "Unknown"}</p>
        <p><strong>Total:</strong> $${amount} ${String(order.currency || "usd").toUpperCase()}</p>
        <p><strong>Shipping:</strong><br />${shipping}</p>
        <p><strong>Received:</strong> ${order.receivedAt}</p>
      `,
    }),
  });

  if (!resendResponse.ok) {
    throw new Error(`Resend email failed: ${await resendResponse.text()}`);
  }
}

module.exports = {
  getConfig,
  response,
  validateItems,
  createCheckoutSession,
  verifyStripeSignature,
  recordCompletedOrder,
  sendAdminOrderEmail,
};
