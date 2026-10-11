const DEFAULT_CHANNEL_ID = "UC4DTiOj4ncwTFGFWB8Rybvw";
const CHANNEL_DESCRIPTION =
  "Biblical and theological teaching that defends the faith and exalts Christ.";

function isShortVideo(video) {
  return video.url.includes("/shorts/") || /(?:^|\s)#shorts\b/i.test(video.title);
}

async function getYouTubeApiJson(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || `YouTube API request failed with status ${response.status}.`);
  }
  return data;
}

async function getYouTubeFeed({
  channelId = DEFAULT_CHANNEL_ID,
  apiKey = process.env.YOUTUBE_API_KEY,
} = {}) {
  if (!apiKey) {
    throw new Error("YouTube API is not configured.");
  }

  const channelParams = new URLSearchParams({
    part: "snippet,contentDetails",
    id: channelId,
    key: apiKey,
  });
  const channelData = await getYouTubeApiJson(
    `https://www.googleapis.com/youtube/v3/channels?${channelParams}`
  );
  const channel = channelData.items?.[0];
  const uploadsPlaylistId = channel?.contentDetails?.relatedPlaylists?.uploads;

  if (!channel || !uploadsPlaylistId) {
    throw new Error("YouTube did not return the configured channel.");
  }

  const playlistParams = new URLSearchParams({
    part: "snippet,contentDetails",
    playlistId: uploadsPlaylistId,
    maxResults: "24",
    key: apiKey,
  });
  const playlistData = await getYouTubeApiJson(
    `https://www.googleapis.com/youtube/v3/playlistItems?${playlistParams}`
  );
  const videos = (playlistData.items || [])
    .map((item) => {
      const id = item.contentDetails?.videoId;
      const snippet = item.snippet || {};
      return {
        id,
        title: snippet.title || "Untitled video",
        url: `https://www.youtube.com/watch?v=${id}`,
        description: snippet.description || "",
        publishedAt: snippet.publishedAt || "",
        thumbnail:
          snippet.thumbnails?.high?.url ||
          snippet.thumbnails?.medium?.url ||
          snippet.thumbnails?.default?.url ||
          "",
        duration: "",
        viewCount: null,
      };
    })
    .filter((video) => video.id && !isShortVideo(video));

  if (!videos.length) {
    throw new Error("YouTube did not return any public videos for this channel.");
  }

  return {
    channel: {
      id: channelId,
      title: channel.snippet?.title || "Love of Truth",
      description: CHANNEL_DESCRIPTION,
      thumbnail:
        channel.snippet?.thumbnails?.medium?.url ||
        channel.snippet?.thumbnails?.default?.url ||
        "References/Full%20logo%20no%20text,%20transparent.png",
      subscriberCount: null,
      videoCount: null,
      viewCount: null,
      url: `https://www.youtube.com/channel/${channelId}`,
    },
    videos,
  };
}

module.exports = { DEFAULT_CHANNEL_ID, getYouTubeFeed, isShortVideo };
