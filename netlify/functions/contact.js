const {
  getConfig,
  response,
  sendContactEmail,
  validateContactSubmission,
} = require("./_lib");

exports.handler = async function handler(event) {
  if (event.httpMethod !== "POST") {
    return response(405, { error: "Method not allowed" });
  }

  try {
    const parsed = JSON.parse(event.body || "{}");
    const submission = validateContactSubmission(parsed);
    await sendContactEmail(submission, getConfig());
    return response(200, { message: "Your message has been sent." });
  } catch (error) {
    return response(400, { error: error.message });
  }
};
