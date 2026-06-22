const { getYouTubeFeed } = require("../../youtube-feed");

exports.handler = async function handler(event) {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const feed = await getYouTubeFeed({
      channelId: process.env.YOUTUBE_CHANNEL_ID,
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      },
      body: JSON.stringify(feed),
    };
  } catch (error) {
    return {
      statusCode: 503,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
