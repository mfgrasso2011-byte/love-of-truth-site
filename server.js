const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { URL, URLSearchParams } = require("url");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

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

function readEnvFile() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) continue;
    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

readEnvFile();

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const DOMAIN = process.env.DOMAIN || `http://localhost:${PORT}`;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || "";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const ORDER_FROM_EMAIL = process.env.ORDER_FROM_EMAIL || "";
const ADMIN_NOTIFY_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || "";
const ENABLE_STRIPE_TAX = String(process.env.ENABLE_STRIPE_TAX || "true") === "true";
const SHIPPING_RATE_UNDER_THRESHOLD = 599;
const FREE_SHIPPING_THRESHOLD = 4000;
const SHIPPING_COUNTRIES = (process.env.SHIPPING_COUNTRIES || "US")
  .split(",")
  .map((code) => code.trim().toUpperCase())
  .filter(Boolean);

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function verifyStripeSignature(rawBody, signatureHeader) {
  if (!STRIPE_WEBHOOK_SECRET) {
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
    .createHmac("sha256", STRIPE_WEBHOOK_SECRET)
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
  const dataDir = path.join(ROOT, "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const record = {
    receivedAt: new Date().toISOString(),
    sessionId: session.id,
    customerEmail: session.customer_details?.email || null,
    customerName: session.customer_details?.name || null,
    amountTotal: session.amount_total,
    currency: session.currency,
    shippingDetails: session.shipping_details || null,
  };

  fs.appendFileSync(path.join(dataDir, "orders.ndjson"), `${JSON.stringify(record)}\n`);
  console.log("Stripe order recorded:", record);
  return record;
}

async function sendAdminOrderEmail(order) {
  if (!RESEND_API_KEY || !ORDER_FROM_EMAIL || !ADMIN_NOTIFY_EMAIL) {
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

  const amount = typeof order.amountTotal === "number" ? (order.amountTotal / 100).toFixed(2) : "0.00";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: ORDER_FROM_EMAIL,
      to: [ADMIN_NOTIFY_EMAIL],
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

  if (!response.ok) {
    const data = await response.text();
    throw new Error(`Resend email failed: ${data}`);
  }
}

function sendFile(res, filepath) {
  const ext = path.extname(filepath).toLowerCase();
  const type = MIME_TYPES[ext] || "application/octet-stream";
  fs.createReadStream(filepath)
    .on("error", () => {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
    })
    .pipe(res.writeHead(200, { "Content-Type": type }));
}

function normalizeStaticPath(urlPath) {
  const pathname = decodeURIComponent(urlPath.split("?")[0]);
  if (pathname === "/") return path.join(ROOT, "index.html");
  const clean = pathname.replace(/^\/+/, "");
  const resolved = path.resolve(ROOT, clean);
  if (!resolved.startsWith(ROOT)) return null;
  return resolved;
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
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

function buildStripeForm(items) {
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", `${DOMAIN}/success.html?session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${DOMAIN}/cancel.html`);

  if (ENABLE_STRIPE_TAX) {
    params.set("automatic_tax[enabled]", "true");
    params.set("billing_address_collection", "required");
  }

  const needsShipping = items.some((item) => item.requiresShipping);
  const physicalSubtotal = items.reduce(
    (sum, item) => sum + (item.requiresShipping ? item.unitAmount * item.quantity : 0),
    0
  );

  if (needsShipping) {
    SHIPPING_COUNTRIES.forEach((country, index) => {
      params.set(`shipping_address_collection[allowed_countries][${index}]`, country);
    });

    if (physicalSubtotal < FREE_SHIPPING_THRESHOLD) {
      params.set("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
      params.set(
        "shipping_options[0][shipping_rate_data][fixed_amount][amount]",
        String(SHIPPING_RATE_UNDER_THRESHOLD)
      );
      params.set("shipping_options[0][shipping_rate_data][fixed_amount][currency]", "usd");
      params.set("shipping_options[0][shipping_rate_data][display_name]", "Standard shipping");
    } else {
      params.set("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
      params.set("shipping_options[0][shipping_rate_data][fixed_amount][amount]", "0");
      params.set("shipping_options[0][shipping_rate_data][fixed_amount][currency]", "usd");
      params.set("shipping_options[0][shipping_rate_data][display_name]", "Free shipping");
    }

    if (ENABLE_STRIPE_TAX) {
      params.set("shipping_options[0][shipping_rate_data][tax_behavior]", "exclusive");
      params.set("shipping_options[0][shipping_rate_data][tax_code]", "txcd_92010001");
    }
  }

  items.forEach((item, index) => {
    params.set(`line_items[${index}][quantity]`, String(item.quantity));
    params.set(`line_items[${index}][price_data][currency]`, "usd");
    params.set(`line_items[${index}][price_data][unit_amount]`, String(item.unitAmount));
    if (ENABLE_STRIPE_TAX) {
      params.set(`line_items[${index}][price_data][tax_behavior]`, "exclusive");
      params.set(`line_items[${index}][price_data][product_data][tax_code]`, item.taxCode);
    }
    params.set(`line_items[${index}][price_data][product_data][name]`, item.name);
  });

  return params;
}

async function createCheckoutSession(items) {
  if (!STRIPE_SECRET_KEY) {
    throw new Error("Missing STRIPE_SECRET_KEY on the server.");
  }

  const form = buildStripeForm(items);
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || "Stripe Checkout session creation failed.";
    throw new Error(message);
  }

  return data;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, DOMAIN);

  if (req.method === "GET" && url.pathname === "/api/config") {
    return json(res, 200, {
      publishableKey: STRIPE_PUBLISHABLE_KEY,
      checkoutEnabled: Boolean(STRIPE_SECRET_KEY && STRIPE_PUBLISHABLE_KEY),
    });
  }

  if (req.method === "POST" && url.pathname === "/api/create-checkout-session") {
    try {
      const body = await collectBody(req);
      const parsed = JSON.parse(body || "{}");
      const items = validateItems(parsed.items);
      const session = await createCheckoutSession(items);
      return json(res, 200, { url: session.url, id: session.id });
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/stripe-webhook") {
    try {
      const rawBody = await collectBody(req);
      verifyStripeSignature(rawBody, req.headers["stripe-signature"]);
      const event = JSON.parse(rawBody || "{}");

      if (event.type === "checkout.session.completed") {
        const order = recordCompletedOrder(event.data.object);
        await sendAdminOrderEmail(order);
      }

      return json(res, 200, { received: true });
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Method not allowed");
    return;
  }

  const filepath = normalizeStaticPath(url.pathname);
  if (!filepath || !fs.existsSync(filepath) || fs.statSync(filepath).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  sendFile(res, filepath);
});

server.listen(PORT, () => {
  console.log(`Love of Truth server running at ${DOMAIN}`);
});
