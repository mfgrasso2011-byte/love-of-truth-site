const {
  getConfig,
  recordCompletedOrder,
  response,
  sendAdminOrderEmail,
  triggerBookfunnelDelivery,
  verifyStripeSignature,
} = require("./_lib");

exports.handler = async function handler(event) {
  if (event.httpMethod !== "POST") {
    return response(405, { error: "Method not allowed" });
  }

  try {
    const rawBody = event.body || "";
    verifyStripeSignature(rawBody, event.headers["stripe-signature"], getConfig().stripeWebhookSecret);
    const parsed = JSON.parse(rawBody || "{}");

    if (parsed.type === "checkout.session.completed") {
      const order = recordCompletedOrder(parsed.data.object);
      console.log("Stripe order recorded:", order);
      await triggerBookfunnelDelivery(order, getConfig());
      await sendAdminOrderEmail(order, getConfig());
    }

    return response(200, { received: true });
  } catch (error) {
    return response(400, { error: error.message });
  }
};
