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
  const bonusEbookQuantity = hasPhysical
    ? cart.reduce((sum, item) => sum + (isPhysicalFormat(item.format) ? Number(item.quantity || 0) : 0), 0)
    : 0;
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

let currentSlide = 0;
let autoplayId;

function setActiveSlide(index) {
  currentSlide = (index + slides.length) % slides.length;

  slides.forEach((slide, slideIndex) => {
    slide.classList.toggle("is-active", slideIndex === currentSlide);
  });

  dots.forEach((dot, dotIndex) => {
    dot.classList.toggle("is-active", dotIndex === currentSlide);
  });
}

function startAutoplay() {
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

if (window.location.pathname.endsWith("success.html")) {
  writeCart([]);
}

updateCartBadge();
renderCart();
setActiveSlide(0);
startAutoplay();
