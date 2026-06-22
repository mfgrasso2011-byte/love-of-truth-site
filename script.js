const slides = Array.from(document.querySelectorAll("[data-slide]"));
const dots = Array.from(document.querySelectorAll("[data-dot]"));
const nextButton = document.querySelector("[data-next]");
const prevButton = document.querySelector("[data-prev]");
const menuToggle = document.querySelector(".menu-toggle");
const siteNav = document.querySelector(".site-nav");
const formatInputs = Array.from(document.querySelectorAll("input[name='format']"));
const productPrice = document.querySelector("[data-product-price]");
const cartCountNodes = Array.from(document.querySelectorAll("[data-cart-count]"));
const addToCartButton = document.querySelector("[data-add-to-cart]");
const quantityInput = document.querySelector("[data-quantity-input]");
const addFeedback = document.querySelector("[data-add-feedback]");
const cartItemsRoot = document.querySelector("[data-cart-items]");
const cartSubtotalNode = document.querySelector("[data-cart-subtotal]");
const cartShippingNode = document.querySelector("[data-cart-shipping]");
const cartFeedback = document.querySelector("[data-cart-feedback]");
const checkoutButton = document.querySelector("[data-checkout-button]");
const shippingStatusNode = document.querySelector("[data-shipping-status]");
const ebookAccessNode = document.querySelector("[data-ebook-access]");
const ebookLinkNode = document.querySelector("[data-ebook-link]");
const ebookAccessMessageNode = document.querySelector("[data-ebook-access-message]");
const ebookAccessCopyNode = document.querySelector("[data-ebook-access-copy]");
const contactForm = document.querySelector("[data-contact-form]");
const contactFeedback = document.querySelector("[data-contact-feedback]");
const contactSubmitButton = document.querySelector("[data-contact-submit]");
const youtubePage = document.querySelector("[data-youtube-page]");
const channelCard = document.querySelector("[data-channel-card]");
const videoGrid = document.querySelector("[data-video-grid]");
const youtubeStatus = document.querySelector("[data-youtube-status]");
const videoDialog = document.querySelector("[data-video-dialog]");
const videoDialogTitle = document.querySelector("[data-video-dialog-title]");
const videoPlayer = document.querySelector("[data-video-player]");
const videoDialogClose = document.querySelector("[data-video-dialog-close]");

const YOUTUBE_PREVIEW_DATA = {
  channel: {
    id: "UC4DTiOj4ncwTFGFWB8Rybvw",
    title: "Love of Truth",
    description:
      "Biblical and theological teaching centered on the unity of Scripture and the confession of Christ.",
    thumbnail: "References/Full%20logo%20no%20text,%20transparent.png",
    subscriberCount: null,
    videoCount: null,
    viewCount: null,
    url: "https://www.youtube.com/channel/UC4DTiOj4ncwTFGFWB8Rybvw",
  },
  videos: [
    {
      id: "Hs28cXGqceI",
      title: "The Unity of Scripture and the Confession of Christ",
      description: "A representative teaching card used to preview the page before the YouTube API is configured.",
      publishedAt: "2026-06-18T12:00:00Z",
      thumbnail: "References/Website%20Slider%20Images/YouTube%20Slider.png",
      duration: "",
      viewCount: "1840",
    },
    {
      id: "Hs28cXGqceI",
      title: "How the Kingdom of God Shapes Christian Hope",
      description: "A representative teaching card used to demonstrate titles, dates, descriptions, and video duration.",
      publishedAt: "2026-06-11T12:00:00Z",
      thumbnail: "References/His%20Kingdom%20Placeholder.png",
      duration: "",
      viewCount: "1270",
    },
    {
      id: "Hs28cXGqceI",
      title: "Reading the Bible as One Coherent Story",
      description: "The production page will replace this sample automatically with the latest public channel upload.",
      publishedAt: "2026-06-04T12:00:00Z",
      thumbnail: "References/Website%20Slider%20Images/Preaching.png",
      duration: "",
      viewCount: "965",
    },
    {
      id: "Hs28cXGqceI",
      title: "Faith, Wisdom, and the Christian Imagination",
      description: "Sample content for evaluating the responsive three-column video catalog and embedded player.",
      publishedAt: "2026-05-28T12:00:00Z",
      thumbnail: "References/Sailing%20to%20Chayah/Sailing%20to%20Chayah%20product%20page%20mockup.png",
      duration: "",
      viewCount: "742",
    },
    {
      id: "Hs28cXGqceI",
      title: "Why Doctrine Matters for Everyday Life",
      description: "Sample content for evaluating the page without consuming API quota or exposing an API key.",
      publishedAt: "2026-05-21T12:00:00Z",
      thumbnail: "References/Website%20Slider%20Images/Preaching%20Slider.png",
      duration: "",
      viewCount: "1380",
    },
    {
      id: "Hs28cXGqceI",
      title: "Truth, Beauty, and the Work of Teaching",
      description: "This final sample fills out the desktop grid and collapses to a single column on small screens.",
      publishedAt: "2026-05-14T12:00:00Z",
      thumbnail: "References/Sailing%20to%20Chayah/A%20Desperate%20Journey%20Ebook%20Cover.jpg",
      duration: "",
      viewCount: "610",
    },
  ],
};

const CART_KEY = "love-of-truth-cart";
const FREE_SHIPPING_THRESHOLD = 4000;
const SHIPPING_RATE_UNDER_THRESHOLD = 599;
const PRODUCT_LABELS = {
  "sailing-to-chayah": "Sailing to Chayah: A Desperate Journey",
};

function isPhysicalFormat(format) {
  return format === "Hardcover" || format === "Paperback";
}

function normalizeCart(cart) {
  const safeCart = Array.isArray(cart) ? cart.filter(Boolean) : [];
  const hasPhysical = safeCart.some((item) => isPhysicalFormat(item.format));
  return hasPhysical ? safeCart.filter((item) => item.format !== "EBook") : safeCart;
}

function readCart() {
  try {
    const stored = window.localStorage.getItem(CART_KEY);
    return normalizeCart(stored ? JSON.parse(stored) : []);
  } catch {
    return [];
  }
}

function writeCart(cart) {
  window.localStorage.setItem(CART_KEY, JSON.stringify(normalizeCart(cart)));
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount / 100);
}

function cartCount(cart) {
  return cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

function updateCartBadge() {
  const count = cartCount(readCart());
  cartCountNodes.forEach((node) => {
    node.textContent = String(count);
    node.hidden = count === 0;
  });
}

function selectedFormat() {
  const checked = formatInputs.find((input) => input.checked);
  return checked ? checked.parentElement?.textContent?.trim() || "Hardcover" : "Hardcover";
}

function addCurrentProductToCart() {
  if (!addToCartButton) return;
  const productId = addToCartButton.dataset.productId;
  const format = selectedFormat();
  const quantity = Math.max(1, Number(quantityInput?.value || 1));
  const cart = readCart();
  const existing = cart.find((item) => item.productId === productId && item.format === format);

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ productId, format, quantity });
  }

  writeCart(cart);
  updateCartBadge();
  if (addFeedback) {
    addFeedback.textContent = `${PRODUCT_LABELS[productId]} (${format}) added to cart.`;
  }
}

function unitAmountFor(item) {
  const priceMap = {
    Hardcover: 2099,
    Paperback: 1499,
    EBook: 499,
  };
  return priceMap[item.format] || 0;
}

function renderCart() {
  if (!cartItemsRoot) return;
  const cart = readCart();
  writeCart(cart);
  if (!cart.length) {
    cartItemsRoot.innerHTML = '<div class="cart-empty">Your cart is empty.</div>';
    if (cartSubtotalNode) cartSubtotalNode.textContent = "$0.00";
    if (cartShippingNode) cartShippingNode.textContent = "$0.00";
    if (shippingStatusNode) shippingStatusNode.textContent = "";
    return;
  }

  let subtotal = 0;
  const hasPhysical = cart.some((item) => isPhysicalFormat(item.format));
  const bonusEbookQuantity = hasPhysical ? 1 : 0;
  const displayItems = cart
    .map((item, index) => {
      const unitAmount = unitAmountFor(item);
      const lineTotal = unitAmount * item.quantity;
      subtotal += lineTotal;
      return `
        <article class="cart-item">
          <div>
            <h3>${PRODUCT_LABELS[item.productId] || item.productId}</h3>
            <p>${item.format}</p>
          </div>
          <label class="cart-item-qty">
            <span>Qty</span>
            <input type="number" min="1" value="${item.quantity}" data-cart-qty="${index}" />
          </label>
          <div class="cart-item-total">${formatCurrency(lineTotal)}</div>
          <button class="cart-remove" type="button" data-cart-remove="${index}">Remove</button>
        </article>
      `;
    })
    .join("");

  const bonusMarkup = bonusEbookQuantity
    ? `
      <article class="cart-item cart-item-bonus">
        <div>
          <h3>${PRODUCT_LABELS["sailing-to-chayah"]}</h3>
          <p>Included EBook Bonus</p>
        </div>
        <div class="cart-item-bonus-qty">Qty ${bonusEbookQuantity}</div>
        <div class="cart-item-total">${formatCurrency(0)}</div>
        <div class="cart-item-bonus-label">Included</div>
      </article>
    `
    : "";

  cartItemsRoot.innerHTML = `${displayItems}${bonusMarkup}`;

  if (cartSubtotalNode) {
    cartSubtotalNode.textContent = formatCurrency(subtotal);
  }

  if (cartShippingNode) {
    const shippingAmount = hasPhysical && subtotal < FREE_SHIPPING_THRESHOLD ? SHIPPING_RATE_UNDER_THRESHOLD : 0;
    cartShippingNode.textContent = formatCurrency(shippingAmount);
  }

  if (shippingStatusNode) {
    if (!hasPhysical) {
      shippingStatusNode.textContent = "No shipping is required for ebook-only orders.";
    } else if (subtotal >= FREE_SHIPPING_THRESHOLD) {
      shippingStatusNode.textContent = "Free shipping is unlocked for this order.";
    } else {
      shippingStatusNode.textContent = `Shipping is ${formatCurrency(SHIPPING_RATE_UNDER_THRESHOLD)} for physical orders under ${formatCurrency(FREE_SHIPPING_THRESHOLD)}. Spend ${formatCurrency(FREE_SHIPPING_THRESHOLD - subtotal)} more to qualify for free shipping.`;
    }
  }

  cartItemsRoot.querySelectorAll("[data-cart-qty]").forEach((input) => {
    input.addEventListener("change", () => {
      const nextCart = readCart();
      const index = Number(input.getAttribute("data-cart-qty"));
      nextCart[index].quantity = Math.max(1, Number(input.value || 1));
      writeCart(nextCart);
      updateCartBadge();
      renderCart();
    });
  });

  cartItemsRoot.querySelectorAll("[data-cart-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextCart = readCart();
      nextCart.splice(Number(button.getAttribute("data-cart-remove")), 1);
      writeCart(nextCart);
      updateCartBadge();
      renderCart();
    });
  });
}

async function beginCheckout() {
  const cart = readCart();
  writeCart(cart);
  if (!cart.length) {
    if (cartFeedback) cartFeedback.textContent = "Your cart is empty.";
    return;
  }

  if (cartFeedback) cartFeedback.textContent = "Redirecting to secure checkout...";

  try {
    const response = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: cart }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Checkout failed.");
    }
    window.location.href = data.url;
  } catch (error) {
    if (cartFeedback) cartFeedback.textContent = error.message;
  }
}

async function loadEbookAccess() {
  if (!ebookAccessNode || !ebookLinkNode) return;

  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id");
  if (!sessionId) {
    if (ebookAccessMessageNode) {
      ebookAccessMessageNode.textContent =
        "If your order includes the ebook, the download link will appear here once your payment is confirmed.";
    }
    return;
  }

  if (ebookAccessMessageNode) {
    ebookAccessMessageNode.textContent = "Checking your ebook access...";
  }

  try {
    const response = await fetch(
      `/api/checkout-session-access?session_id=${encodeURIComponent(sessionId)}`
    );
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to load ebook access.");
    }

    if (data.ebookEligible && data.ebookUrl) {
      ebookLinkNode.href = data.ebookUrl;
      ebookAccessNode.hidden = false;
      if (ebookAccessMessageNode) ebookAccessMessageNode.textContent = "";
      if (ebookAccessCopyNode) {
        ebookAccessCopyNode.textContent =
          "Your order includes the ebook. Redirecting you to BookFunnel now. If nothing happens, use the button below.";
      }
      window.setTimeout(() => {
        window.location.href = data.ebookUrl;
      }, 1200);
      return;
    }

    if (ebookAccessMessageNode) {
      ebookAccessMessageNode.textContent = "This order does not include the ebook.";
    }
  } catch (error) {
    if (ebookAccessMessageNode) {
      ebookAccessMessageNode.textContent = error.message;
    }
  }
}

async function submitContactForm(event) {
  event.preventDefault();
  if (!contactForm) return;

  const formData = new FormData(contactForm);
  const payload = {
    name: String(formData.get("name") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    message: String(formData.get("message") || "").trim(),
  };

  if (contactFeedback) {
    contactFeedback.textContent = "Sending your message...";
  }

  if (contactSubmitButton) {
    contactSubmitButton.disabled = true;
  }

  try {
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to send your message.");
    }

    contactForm.reset();
    if (contactFeedback) {
      contactFeedback.textContent = data.message || "Your message has been sent.";
    }
  } catch (error) {
    if (contactFeedback) {
      contactFeedback.textContent = error.message;
    }
  } finally {
    if (contactSubmitButton) {
      contactSubmitButton.disabled = false;
    }
  }
}

function compactNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(number);
}

function formatVideoDuration(value) {
  const match = String(value || "").match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "";
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatPublishedDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function truncateDescription(value, length = 155) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return normalized.length > length ? `${normalized.slice(0, length).trim()}…` : normalized;
}

function openVideo(video) {
  if (!videoDialog || !videoPlayer) {
    window.open(`https://www.youtube.com/watch?v=${video.id}`, "_blank", "noopener");
    return;
  }

  if (videoDialogTitle) videoDialogTitle.textContent = video.title;
  const iframe = document.createElement("iframe");
  iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.id)}?autoplay=1&rel=0`;
  iframe.title = video.title;
  iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.allowFullscreen = true;
  videoPlayer.replaceChildren(iframe);
  videoDialog.showModal();
}

function closeVideo() {
  videoDialog?.close();
  videoPlayer?.replaceChildren();
}

function renderChannel(channel) {
  if (!channelCard) return;

  const avatar = document.createElement("img");
  avatar.className = "channel-avatar";
  avatar.src = channel.thumbnail;
  avatar.alt = `${channel.title} channel profile`;

  const summary = document.createElement("div");
  summary.className = "channel-summary";
  const title = document.createElement("h2");
  title.textContent = channel.title;
  const stats = document.createElement("p");
  stats.className = "channel-stats";
  const statParts = [];
  if (channel.subscriberCount) statParts.push(`${compactNumber(channel.subscriberCount)} subscribers`);
  if (channel.videoCount) statParts.push(`${compactNumber(channel.videoCount)} videos`);
  if (channel.viewCount) statParts.push(`${compactNumber(channel.viewCount)} views`);
  stats.textContent = statParts.join("  •  ");
  const description = document.createElement("p");
  description.className = "channel-description";
  description.textContent = truncateDescription(channel.description, 220);
  summary.append(title);
  if (statParts.length) summary.append(stats);
  summary.append(description);

  const subscribe = document.createElement("a");
  subscribe.className = "youtube-subscribe-button";
  subscribe.href = `${channel.url}?sub_confirmation=1`;
  subscribe.target = "_blank";
  subscribe.rel = "noreferrer";
  subscribe.textContent = "YouTube";

  channelCard.replaceChildren(avatar, summary, subscribe);
}

function renderVideos(videos) {
  if (!videoGrid) return;
  const fragment = document.createDocumentFragment();

  videos.forEach((video) => {
    const article = document.createElement("article");
    article.className = "video-card";

    const trigger = document.createElement("button");
    trigger.className = "video-thumbnail-button";
    trigger.type = "button";
    trigger.setAttribute("aria-label", `Play ${video.title}`);
    trigger.addEventListener("click", () => openVideo(video));

    const thumbnail = document.createElement("img");
    thumbnail.src = video.thumbnail;
    thumbnail.alt = "";
    thumbnail.loading = "lazy";
    thumbnail.width = 480;
    thumbnail.height = 270;
    const play = document.createElement("span");
    play.className = "video-play-icon";
    play.setAttribute("aria-hidden", "true");
    const duration = document.createElement("span");
    duration.className = "video-duration";
    duration.textContent = formatVideoDuration(video.duration);
    trigger.append(thumbnail, play, duration);

    const body = document.createElement("div");
    body.className = "video-card-body";
    const title = document.createElement("h3");
    const titleButton = document.createElement("button");
    titleButton.type = "button";
    titleButton.textContent = video.title;
    titleButton.addEventListener("click", () => openVideo(video));
    title.append(titleButton);
    const meta = document.createElement("p");
    meta.className = "video-meta";
    const metaParts = [formatPublishedDate(video.publishedAt)];
    if (video.viewCount) metaParts.push(`${compactNumber(video.viewCount)} views`);
    meta.textContent = metaParts.filter(Boolean).join("  •  ");
    const description = document.createElement("p");
    description.className = "video-description";
    description.textContent = truncateDescription(video.description);
    body.append(title, meta, description);
    article.append(trigger, body);
    fragment.append(article);
  });

  videoGrid.replaceChildren(fragment);
}

async function loadYouTubeFeed() {
  if (!youtubePage) return;

  try {
    const isPreview = new URLSearchParams(window.location.search).get("preview") === "1";
    if (isPreview) {
      renderChannel(YOUTUBE_PREVIEW_DATA.channel);
      renderVideos(YOUTUBE_PREVIEW_DATA.videos);
      if (youtubeStatus) {
        youtubeStatus.classList.add("is-preview");
        youtubeStatus.textContent =
          "Local preview data — the deployed page will use your current YouTube channel information.";
      }
      return;
    }

    const response = await fetch("/api/youtube-feed");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load the YouTube channel.");

    renderChannel(data.channel);
    renderVideos(data.videos || []);
    if (youtubeStatus) {
      youtubeStatus.textContent = data.videos?.length ? "" : "No public videos were found.";
    }
  } catch (error) {
    const loadingMessage = channelCard?.querySelector(".channel-loading");
    if (loadingMessage) loadingMessage.textContent = "Latest videos are temporarily unavailable.";
    if (youtubeStatus) {
      youtubeStatus.innerHTML = "";
      const message = document.createElement("p");
      message.textContent = error.message;
      const link = document.createElement("a");
      link.href = "https://www.youtube.com/channel/UC4DTiOj4ncwTFGFWB8Rybvw";
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "Watch on YouTube instead";
      youtubeStatus.append(message, link);
    }
  }
}

let currentSlide = 0;
let autoplayId;

function setActiveSlide(index) {
  if (!slides.length) return;
  currentSlide = (index + slides.length) % slides.length;

  slides.forEach((slide, slideIndex) => {
    slide.classList.toggle("is-active", slideIndex === currentSlide);
  });

  dots.forEach((dot, dotIndex) => {
    dot.classList.toggle("is-active", dotIndex === currentSlide);
  });
}

function startAutoplay() {
  if (!slides.length) return;
  stopAutoplay();
  autoplayId = window.setInterval(() => {
    setActiveSlide(currentSlide + 1);
  }, 6000);
}

function stopAutoplay() {
  if (autoplayId) {
    window.clearInterval(autoplayId);
  }
}

nextButton?.addEventListener("click", () => {
  setActiveSlide(currentSlide + 1);
  startAutoplay();
});

prevButton?.addEventListener("click", () => {
  setActiveSlide(currentSlide - 1);
  startAutoplay();
});

dots.forEach((dot) => {
  dot.addEventListener("click", () => {
    setActiveSlide(Number(dot.dataset.dot));
    startAutoplay();
  });
});

menuToggle?.addEventListener("click", () => {
  const isOpen = siteNav.classList.toggle("is-open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
});

siteNav?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    siteNav.classList.remove("is-open");
    menuToggle?.setAttribute("aria-expanded", "false");
  });
});

formatInputs.forEach((input) => {
  input.addEventListener("change", () => {
    if (!productPrice) {
      return;
    }

    productPrice.textContent = `$${Number(input.value).toFixed(2)}`;
  });
});

addToCartButton?.addEventListener("click", addCurrentProductToCart);
checkoutButton?.addEventListener("click", beginCheckout);
contactForm?.addEventListener("submit", submitContactForm);
videoDialogClose?.addEventListener("click", closeVideo);
videoDialog?.addEventListener("click", (event) => {
  if (event.target === videoDialog) closeVideo();
});
videoDialog?.addEventListener("close", () => videoPlayer?.replaceChildren());
loadEbookAccess();
loadYouTubeFeed();

if (window.location.pathname.endsWith("success.html")) {
  writeCart([]);
}

updateCartBadge();
renderCart();
setActiveSlide(0);
startAutoplay();
