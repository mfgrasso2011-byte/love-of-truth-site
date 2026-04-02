const {
  createCheckoutSession,
  getConfig,
  response,
  validateItems,
} = require("./_lib");

exports.handler = async function handler(event) {
  if (event.httpMethod !== "POST") {
    return response(405, { error: "Method not allowed" });
  }

  try {
    const parsed = JSON.parse(event.body || "{}");
    const items = validateItems(parsed.items);
    const session = await createCheckoutSession(items, getConfig());
    return response(200, { url: session.url, id: session.id });
  } catch (error) {
    return response(400, { error: error.message });
  }
};
