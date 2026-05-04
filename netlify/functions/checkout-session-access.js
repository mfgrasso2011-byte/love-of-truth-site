const {
  getConfig,
  response,
  retrieveCheckoutSession,
} = require("./_lib");

exports.handler = async function handler(event) {
  if (event.httpMethod !== "GET") {
    return response(405, { error: "Method not allowed" });
  }

  try {
    const sessionId = event.queryStringParameters?.session_id || "";
    if (!sessionId) {
      return response(400, { error: "Missing session_id." });
    }

    const config = getConfig();
    const session = await retrieveCheckoutSession(sessionId, config);
    const ebookEligible =
      session.payment_status === "paid" &&
      Math.max(0, Number(session.metadata?.ebook_delivery_quantity || 0)) > 0;

    return response(200, {
      ebookEligible,
      ebookUrl: ebookEligible ? config.bookfunnelEbookUrl : "",
    });
  } catch (error) {
    return response(400, { error: error.message });
  }
};
