const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const statusFlow = ["menunggu pembayaran", "dibayar", "diproses", "dimasak", "siap", "selesai"];

const moodMeta = {
  pedas: {
    label: "Mood Pedas",
    short: "Pedas",
    tone: "Bakso pedas, sambal strong, dan cita rasa yang menggugah!",
    accent: "#ff5252",
    image: "/IMAGE_FIXX/Bakso/Bakso.jpeg"
  },
  manis: {
    label: "Mood Manis",
    short: "Manis",
    tone: "Es blend creamy, minuman manis, dan cita rasa yang lembut.",
    accent: "#ff8a5c",
    image: "/IMAGE_FIXX/Minuman/Es Blend.jpeg"
  },
  asin: {
    label: "Mood Asin",
    short: "Asin",
    tone: "Bakso gurih, risol renyah, dan sosis crispy untuk berbagi.",
    accent: "#f06035",
    image: "/IMAGE_FIXX/Bakso/Bakso.jpeg"
  },
  segar: {
    label: "Mood Segar",
    short: "Segar",
    tone: "Jus segar, air mineral, dan minuman dingin penyeimbang.",
    accent: "#ffbc42",
    image: "/IMAGE_FIXX/Minuman/Jus.jpeg"
  }
};

const state = {
  moods: [],
  menus: [],
  selectedMood: "",
  category: "all",
  cart: new Map(),
  activeOrder: null,
  orderHistory: [],
  sessionId: "",
  tableNo: "01",
  pendingCustomization: null
};

function api(path, options = {}) {
  return fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  }).then(async response => {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Permintaan gagal.");
    return data;
  });
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2500);
}

function initSession() {
  const url = new URL(window.location.href);
  state.tableNo = (url.searchParams.get("meja") || localStorage.getItem("moodTable") || "01").padStart(2, "0");
  state.sessionId = `QR-${state.tableNo}-${Date.now().toString(36).toUpperCase()}`;
  localStorage.setItem("moodTable", state.tableNo);
  document.getElementById("tableLabel").textContent = state.tableNo;
  document.getElementById("moodTableLabel").textContent = state.tableNo;
}

function getMenuImage(menu) {
  return menu.image || "/IMAGE_FIXX/Sampul/Background_web_halaman_kantin.jpeg";
}

function renderMoods() {
  const moodList = document.getElementById("moodList");
  const moodCodes = state.moods.length ? state.moods.map(mood => mood.code) : Object.keys(moodMeta);

  moodList.innerHTML = moodCodes.map(code => {
    const meta = moodMeta[code] || { label: code, short: code, tone: "", image: "", accent: "#ef4d3f" };
    const active = state.selectedMood === code ? "active" : "";
    return `
      <button class="mood-card ${active}" onclick="selectMood('${code}')" style="--mood-accent:${meta.accent}" type="button">
        <img src="${meta.image}" alt="${meta.label}">
        <span>
          <b>${meta.label}</b>
          <small>${meta.tone}</small>
        </span>
        <strong>${meta.short}</strong>
      </button>
    `;
  }).join("");
}

function selectMood(code) {
  state.selectedMood = code;
  const meta = moodMeta[code];
  document.getElementById("currentMoodTitle").textContent = meta ? meta.label : "Semua Menu";
  document.getElementById("menuHeroTitle").textContent = meta ? `Rekomendasi ${meta.short}` : "Discover our menu";
  renderMoods();
  renderMenus();
  document.getElementById("menuSection").scrollIntoView({ behavior: "smooth", block: "start" });
}

function filterCategory(cat) {
  state.category = cat;
  document.querySelectorAll(".tab").forEach(tab => {
    const isActive = (cat === "all" && tab.textContent === "Semua") ||
      tab.textContent === cat;
    tab.classList.toggle("active", isActive);
  });
  renderMenus();
}

function renderMenus() {
  const grid = document.getElementById("menuGrid");
  const filtered = state.menus.filter(menu => {
    const moodMatch = !state.selectedMood || menu.mood.includes(state.selectedMood);
    const categoryMatch = state.category === "all" || menu.category === state.category;
    return menu.stock && moodMatch && categoryMatch;
  });

  document.getElementById("menuCount").textContent = `${filtered.length} menu`;

  if (!filtered.length) {
    grid.innerHTML = `<div class="empty">Menu untuk filter ini belum tersedia.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(menu => `
    <article class="menu-card">
      <div class="menu-img-wrap">
        <img src="${getMenuImage(menu)}" class="menu-img" alt="${menu.name}">
        <span>${menu.category}</span>
      </div>
      <div class="menu-info">
        <div>
          <h3>${menu.name}</h3>
          <p>${menu.description || "Menu favorit pelanggan Gacoan."}</p>
        </div>
        <div class="menu-bottom">
          <strong>${rupiah.format(menu.price)}</strong>
          <button class="add-btn" onclick="addToCart('${menu.id}')" type="button">Pilih</button>
        </div>
      </div>
    </article>
  `).join("");
}

function addToCart(menuId) {
  const menu = state.menus.find(m => m.id === menuId);
  if (!menu) return;

  if (menu.customizations && menu.customizations.length > 0) {
    const selections = {};
    menu.customizations.forEach(custom => {
      if (custom.type === "radio" && custom.default) selections[custom.id] = custom.default;
    });
    // Show customization modal
    state.pendingCustomization = {
      menuId: menuId,
      menu: menu,
      selections
    };
    showCustomizationModal(menu);
  } else {
    // Add directly if no customizations
    addToCartDirect(menuId, {}, menu.price);
  }
}

function showCustomizationModal(menu) {
  const modal = document.getElementById("customizationModal");
  const content = document.getElementById("customizationContent");

  let html = `<div>
    <h2>${menu.name}</h2>
    <p style="color: #666; font-size: 0.9rem;">${menu.description}</p>
    <div style="margin: 20px 0;">`;

  menu.customizations.forEach(custom => {
    html += `<div style="margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 14px;">
      <strong style="display: block; margin-bottom: 10px; font-size: 1.1rem; color: #191821;">${custom.name}</strong>`;

    if (custom.type === "radio") {
      custom.options.forEach(opt => {
        const id = `${custom.id}_${opt.value}`;
        html += `<label style="display: block; margin: 8px 0; cursor: pointer;">
          <input type="radio" name="${custom.id}" value="${opt.value}" ${opt.value === custom.default ? "checked" : ""} 
                 onchange="updateCustomization('${custom.id}', '${opt.value}')">
          ${opt.label}
        </label>`;
      });
    } else if (custom.type === "checkbox") {
      custom.options.forEach(opt => {
        html += `<label style="display: block; margin: 8px 0; cursor: pointer;">
          <input type="checkbox" name="${custom.id}" value="${opt.value}" 
                 onchange="toggleCheckbox('${custom.id}', '${opt.value}')">
          ${opt.label}
        </label>`;
      });
    }

    html += `</div>`;
  });

  html += `</div>
    <div style="display: flex; gap: 10px; margin-top: 20px;">
      <button class="secondary-btn" onclick="closeCustomization()" style="flex: 1;">Batal</button>
      <button class="primary-btn" onclick="confirmCustomization()" style="flex: 1;">Tambah ke Keranjang</button>
    </div>
  </div>`;

  content.innerHTML = html;
  modal.classList.add("active");
}

function updateCustomization(customId, value) {
  if (state.pendingCustomization) {
    state.pendingCustomization.selections[customId] = value;
  }
}

function toggleCheckbox(customId, value) {
  if (state.pendingCustomization) {
    if (!state.pendingCustomization.selections[customId]) {
      state.pendingCustomization.selections[customId] = [];
    }
    const arr = state.pendingCustomization.selections[customId];
    const idx = arr.indexOf(value);
    if (idx >= 0) {
      arr.splice(idx, 1);
    } else {
      arr.push(value);
    }
  }
}

function closeCustomization() {
  document.getElementById("customizationModal").classList.remove("active");
  state.pendingCustomization = null;
}

function confirmCustomization() {
  if (!state.pendingCustomization) return;
  const { menuId, menu, selections } = state.pendingCustomization;
  
  // Calculate additional price from selections (if any upgrades)
  let additionalPrice = 0;
  const customizationText = [];

  menu.customizations.forEach(custom => {
    const selected = selections[custom.id];
    if (selected) {
      if (custom.type === "radio") {
        const opt = custom.options.find(o => o.value === selected);
        if (opt) customizationText.push(`${custom.name}: ${opt.label}`);
      } else if (custom.type === "checkbox") {
        const selectedOpts = Array.isArray(selected) ? selected : [selected];
        selectedOpts.forEach(val => {
          const opt = custom.options.find(o => o.value === val);
          if (opt) customizationText.push(`+ ${opt.label}`);
        });
      }
    }
  });

  addToCartDirect(menuId, selections, menu.price, customizationText.join(", "));
  closeCustomization();
}

function addToCartDirect(menuId, customizations = {}, basePrice, customizationNote = "") {
  const cartKey = `${menuId}_${JSON.stringify(customizations)}`;
  const existing = state.cart.get(cartKey);
  
  state.cart.set(cartKey, {
    menuId,
    qty: existing ? existing.qty + 1 : 1,
    customizations,
    basePrice,
    customizationNote
  });

  updateCartBadge();
  renderCart();
  showToast("Menu ditambahkan ke keranjang.");
}

function updateCartBadge() {
  const totalQty = [...state.cart.values()].reduce((sum, item) => sum + item.qty, 0);
  document.getElementById("cartCountBadge").textContent = totalQty;
}

function scrollToCart() {
  document.getElementById("cartPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderCart() {
  const cartBody = document.getElementById("cartItems");
  const items = [...state.cart.entries()].map(([key, cartItem]) => {
    const menu = state.menus.find(entry => entry.id === cartItem.menuId);
    return { ...cartItem, menu, key };
  }).filter(item => item.menu);

  if (!items.length) {
    cartBody.innerHTML = `<div class="empty cart-empty">Keranjang masih kosong.</div>`;
  } else {
    cartBody.innerHTML = items.map(item => `
      <div class="cart-item">
        <img src="${getMenuImage(item.menu)}" alt="${item.menu.name}">
        <div style="flex: 1;">
          <strong>${item.menu.name}</strong>
          <span>${rupiah.format(item.basePrice || item.menu.price)}</span>
          ${item.customizationNote ? `<div style="font-size: 0.85rem; color: #666; margin-top: 4px;">Catatan: ${item.customizationNote}</div>` : ""}
        </div>
        <div class="qty-controls">
          <button onclick="changeQty('${item.key}', -1)" type="button">-</button>
          <b>${item.qty}</b>
          <button onclick="changeQty('${item.key}', 1)" type="button">+</button>
        </div>
      </div>
    `).join("");
  }

  const total = items.reduce((sum, item) => sum + (item.basePrice || item.menu.price) * item.qty, 0);
  document.getElementById("cartTotal").textContent = rupiah.format(total);
}

function renderHistory() {
  const historyList = document.getElementById("historyList");
  const orders = state.orderHistory.slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  if (!orders.length) {
    historyList.innerHTML = `<div class="empty">Belum ada riwayat pesanan untuk meja ini.</div>`;
    return;
  }

  historyList.innerHTML = orders.map(order => {
    const items = order.items.map(item => {
      const menu = state.menus.find(entry => entry.id === item.menuId);
      return `<li>${item.qty}x ${menu ? menu.name : item.menuId}${item.note ? ` (${item.note})` : ""}</li>`;
    }).join("");
    return `
      <article class="order-card">
        <header>
          <div>
            <strong>${order.id}</strong>
            <span>Meja ${order.tableNo} • ${order.orderStatus}</span>
          </div>
          <b>${rupiah.format(order.total)}</b>
        </header>
        <ul>${items}</ul>
        ${order.note ? `<p><em>Catatan: ${order.note}</em></p>` : ""}
        <div class="status-steps history-steps">
          ${statusFlow.map((status, index) => `
            <span class="history-step ${order.orderStatus === status || statusFlow.indexOf(order.orderStatus) > index ? "active" : ""}">${status}</span>
          `).join("")}
        </div>
      </article>
    `;
  }).join("");
}

function changeQty(key, delta) {
  const item = state.cart.get(key);
  if (!item) return;
  const newQty = item.qty + delta;
  if (newQty <= 0) state.cart.delete(key);
  else state.cart.set(key, { ...item, qty: newQty });
  renderCart();
  updateCartBadge();
}

async function checkout() {
  const items = [...state.cart.entries()].map(([key, cartItem]) => ({
    menuId: cartItem.menuId,
    qty: cartItem.qty,
    customizations: cartItem.customizations,
    note: cartItem.customizationNote
  }));

  if (!items.length) {
    showToast("Pilih menu dulu sebelum checkout.");
    return;
  }

  try {
    const { order } = await api("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        sessionId: state.sessionId,
        tableNo: state.tableNo,
        mood: state.selectedMood,
        note: document.getElementById("orderNote").value,
        items
      })
    });
    state.activeOrder = order;
    state.orderHistory.unshift(order);
    state.cart.clear();
    updateCartBadge();
    renderCart();
    renderStatus();
    renderHistory();
    document.getElementById("statusOverlay").classList.add("active");
  } catch (err) {
    showToast(err.message);
  }
}

function closeStatus() {
  document.getElementById("statusOverlay").classList.remove("active");
}

function renderStatus() {
  const container = document.getElementById("activeOrderContent");
  const order = state.activeOrder;
  if (!order) return;

  const currentIndex = Math.max(0, statusFlow.indexOf(order.orderStatus));
  
  const itemsHtml = order.items.map(item => {
    const menu = state.menus.find(m => m.id === item.menuId);
    return `<div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee;">
      <div>
        <strong>${menu ? menu.name : item.menuId}</strong> × ${item.qty}
        ${item.note ? `<div style="font-size: 0.85rem; color: #666;">${item.note}</div>` : ""}
      </div>
      <div style="text-align: right;">${rupiah.format((menu ? menu.price : 0) * item.qty)}</div>
    </div>`;
  }).join("");

  container.innerHTML = `
    <div class="status-card">
      <p class="eyebrow">✓ Pesanan Berhasil Dibuat</p>
      <h3 style="margin: 10px 0; font-size: 1.5rem; text-align: center;">${order.id}</h3>
      
      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(order.id + '|' + order.total + '|' + state.tableNo)}" alt="QR pembayaran" style="max-width: 100%;">
        <p style="margin-top: 12px; font-size: 0.9rem; color: #666;">Scan QR code di kasir untuk pembayaran</p>
      </div>
      
      <div style="margin: 20px 0; background: #f0f8ff; padding: 15px; border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span>Meja:</span>
          <strong>${order.tableNo}</strong>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Total Pesanan:</span>
          <strong style="font-size: 1.3rem; color: #e74c3c;">${rupiah.format(order.total)}</strong>
        </div>
      </div>

      <div style="margin: 20px 0;">
        <p style="font-weight: 600; margin-bottom: 10px;">Detail Pesanan:</p>
        <div style="border: 1px solid #eee; border-radius: 6px; padding: 12px;">
          ${itemsHtml || '<div style="color: #999;">Tidak ada item</div>'}
        </div>
      </div>

      <button class="checkout-btn" onclick="simulatePayment()" ${order.paymentStatus ? "disabled" : ""} type="button" style="width: 100%; margin-bottom: 10px;">
        ${order.paymentStatus ? "✓ Sudah Dibayar" : "Simulasi Bayar QRIS"}
      </button>
    </div>

    <div class="status-steps" style="margin-top: 20px;">
      <p style="font-weight: 600; margin-bottom: 15px; font-size: 0.95rem;">Status Pesanan:</p>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        ${statusFlow.map((status, index) => `
          <div style="flex: 1; text-align: center; ${index < statusFlow.length - 1 ? 'border-right: 2px solid #eee;' : ''}">
            <div style="width: 36px; height: 36px; margin: 0 auto 8px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; ${index <= currentIndex ? 'background: #27ae60; color: white;' : 'background: #ecf0f1; color: #999;'}">${index < currentIndex ? "✓" : index + 1}</div>
            <span style="font-size: 0.8rem; ${index <= currentIndex ? 'color: #27ae60;' : 'color: #999;'}">${status}</span>
          </div>
        `).join("")}
      </div>
    </div>
    
    <div class="status-actions" style="display: flex; gap: 10px; margin-top: 20px;">
      <button class="secondary-btn" type="button" onclick="closeStatus()" style="flex: 1;">Tutup</button>
      <button class="secondary-btn" type="button" onclick="document.getElementById('historySection').scrollIntoView({ behavior: 'smooth' })" style="flex: 1;">Lihat Riwayat</button>
    </div>
  `;
}

async function simulatePayment() {
  if (!state.activeOrder) return;
  try {
    const { order } = await api(`/api/orders/${state.activeOrder.id}/pay`, {
      method: "POST",
      body: JSON.stringify({ method: "qris" })
    });
    state.activeOrder = order;
    const historyIndex = state.orderHistory.findIndex(entry => entry.id === order.id);
    if (historyIndex >= 0) state.orderHistory[historyIndex] = order;
    renderStatus();
    renderHistory();
    showToast("Pembayaran berhasil.");
  } catch (err) {
    showToast(err.message);
  }
}

async function loadData() {
  const data = await api("/api/bootstrap");
  state.moods = data.moods;
  state.menus = data.menus;
  state.orderHistory = data.orders.filter(order => order.tableNo === state.tableNo || order.sessionId === state.sessionId);
  renderMoods();
  renderMenus();
  renderCart();
  renderHistory();
}

window.setInterval(async () => {
  if (state.activeOrder && state.activeOrder.orderStatus !== "selesai") {
    try {
      const { order } = await api(`/api/orders/${state.activeOrder.id}`);
      state.activeOrder = order;
      renderStatus();
    } catch (e) {}
  }
}, 4000);

initSession();
loadData().catch(error => showToast(error.message));
