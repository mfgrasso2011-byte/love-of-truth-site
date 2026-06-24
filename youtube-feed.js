const DEFAULT_CHANNEL_ID = "UC4DTiOj4ncwTFGFWB8Rybvw";
const CHANNEL_DESCRIPTION =
  "Biblical and theological teaching that defends the faith and exalts Christ.";

function decodeXml(value = "") {
  const namedEntities = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    quot: '"',
  };

  return String(value).replace(/&(#x[\da-f]+|#\d+|amp|apos|gt|lt|quot);/gi, (match, entity) => {
    if (entity[0] === "#") {
      const isHex = entity[1].toLowerCase() === "x";
      const number = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(number) ? String.fromCodePoint(number) : match;
    }
    return namedEntities[entity.toLowerCase()] || match;
  });
}

function tagValue(xml, tagName) {
  const escapedTag = tagName.replace(":", "\\:");
  const match = xml.match(new RegExp(`<${escapedTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapedTag}>`, "i"));
  return decodeXml(match?.[1]?.trim() || "");
}

function attributeValue(xml, tagName, attributeName) {
  const escapedTag = tagName.replace(":", "\\:");
  const match = xml.match(new RegExp(`<${escapedTag}\\s[^>]*${attributeName}="([^"]*)"[^>]*>`, "i"));
  return decodeXml(match?.[1] || "");
}

function isShortVideo(video) {
  return video.url.includes("/shorts/") || /(?:^|\s)#shorts\b/i.test(video.title);
}

function parseYouTubeFeed(xml, channelId) {
  const header = xml.split(/<entry>/i)[0];
  const entryMatches = Array.from(xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi));
  const videos = entryMatches.map((match) => {
    const entry = match[1];
    return {
      id: tagValue(entry, "yt:videoId"),
      title: tagValue(entry, "title") || "Untitled video",
      url: attributeValue(entry, "link", "href"),
      description: tagValue(entry, "media:description"),
      publishedAt: tagValue(entry, "published"),
      thumbnail: attributeValue(entry, "media:thumbnail", "url"),
      duration: "",
      viewCount: attributeValue(entry, "media:statistics", "views") || null,
    };
  }).filter((video) => video.id && !isShortVideo(video));

  return {
    channel: {
      id: channelId,
      title: tagValue(header, "title") || "Love of Truth",
      description: CHANNEL_DESCRIPTION,
      thumbnail: "References/Full%20logo%20no%20text,%20transparent.png",
      subscriberCount: null,
      videoCount: null,
      viewCount: null,
      url: `https://www.youtube.com/channel/${channelId}`,
    },
    videos,
  };
}

async function getYouTubeFeed({ channelId = DEFAULT_CHANNEL_ID } = {}) {
  const response = await fetch(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`,
    {
      headers: {
        Accept: "application/atom+xml, application/xml;q=0.9, text/xml;q=0.8",
        "User-Agent": "Love-of-Truth-Website/1.0",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`YouTube feed request failed with status ${response.status}.`);
  }

  const xml = await response.text();
  const feed = parseYouTubeFeed(xml, channelId);
  if (!feed.videos.length) {
    throw new Error("YouTube did not return any public videos for this channel.");
  }
  return feed;
}

module.exports = { DEFAULT_CHANNEL_ID, getYouTubeFeed, isShortVideo, parseYouTubeFeed };
