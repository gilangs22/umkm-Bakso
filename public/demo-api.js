const DEMO_STORE_KEY = "baksoMakYasDemoStore";

const demoMoods = [
  { code: "pedas", label: "Pedas", tone: "Panas, berani, menggugah selera!" },
  { code: "manis", label: "Manis", tone: "Lembut, nyaman, penutup rasa yang sempurna." },
  { code: "asin", label: "Asin", tone: "Gurih, renyah, cocok untuk berbagi bareng teman." },
  { code: "segar", label: "Segar", tone: "Ringan, dingin, penyeimbang rasa yang pas." }
];

let demoStorePromise = null;

function cloneDemo(value) {
  return JSON.parse(JSON.stringify(value));
}

function saveDemoStore(store) {
  localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(store));
}

async function getDemoStore() {
  if (demoStorePromise) return demoStorePromise;
  demoStorePromise = (async () => {
    const saved = localStorage.getItem(DEMO_STORE_KEY);
    if (saved) return JSON.parse(saved);
    const response = await fetch("/store.json");
    const store = await response.json();
    if (store.menus && store.menus[0] && store.menus[0].name === "Baksoh") {
      store.menus[0].name = "Bakso";
    }
    saveDemoStore(store);
    return store;
  })();
  return demoStorePromise;
}

function enrichOrder(order, menus) {
  const items = order.items.map(item => {
    const menu = menus.find(entry => entry.id === item.menuId);
    return {
      ...item,
      menu,
      subtotal: menu ? menu.price * item.qty : 0
    };
  });
  return {
    ...order,
    items,
    total: items.reduce((sum, item) => sum + item.subtotal, 0)
  };
}

function nextMenuId(menus) {
  const maxId = menus.reduce((max, menu) => {
    const number = Number(String(menu.id || "").replace(/\D/g, ""));
    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 0);
  return `M${String(maxId + 1).padStart(3, "0")}`;
}

async function demoApi(path, options = {}) {
  const store = await getDemoStore();
  const method = String(options.method || "GET").toUpperCase();
  const url = new URL(path, window.location.origin);
  const parts = url.pathname.split("/").filter(Boolean);
  const body = options.body ? JSON.parse(options.body) : {};

  if (method === "POST" && url.pathname === "/api/auth/login") {
    const username = String(body.username || "").trim().toLowerCase();
    const user = store.users.find(entry => entry.username === username) || store.users.find(entry => entry.username === "admin");
    if (!user || !body.password) throw new Error("Username atau password salah.");
    return { user, token: `demo-${user.username}-${Date.now()}` };
  }

  if (method === "GET" && url.pathname === "/api/bootstrap") {
    return {
      moods: cloneDemo(demoMoods),
      menus: cloneDemo(store.menus),
      orders: store.orders.map(order => enrichOrder(order, store.menus))
    };
  }

  if (method === "POST" && url.pathname === "/api/orders") {
    const items = (body.items || [])
      .map(item => ({ menuId: item.menuId, qty: Math.max(1, Number(item.qty) || 1), note: String(item.note || "") }))
      .filter(item => store.menus.some(menu => menu.id === item.menuId && menu.stock !== false));
    if (!items.length) throw new Error("Tidak ada menu tersedia dalam pesanan.");
    const order = {
      id: `ORD-${Date.now()}`,
      sessionId: body.sessionId,
      tableNo: String(body.tableNo || "01").padStart(2, "0"),
      mood: body.mood || null,
      items,
      note: String(body.note || ""),
      paymentStatus: 0,
      orderStatus: "menunggu pembayaran",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    store.orders.unshift(order);
    saveDemoStore(store);
    return { order: enrichOrder(order, store.menus) };
  }

  if (method === "GET" && parts[0] === "api" && parts[1] === "orders" && parts[2]) {
    const order = store.orders.find(entry => entry.id === parts[2]);
    if (!order) throw new Error("Pesanan tidak ditemukan.");
    return { order: enrichOrder(order, store.menus), logs: [] };
  }

  if (method === "POST" && parts[0] === "api" && parts[1] === "orders" && parts[3] === "pay") {
    const order = store.orders.find(entry => entry.id === parts[2]);
    if (!order) throw new Error("Pesanan tidak ditemukan.");
    order.paymentStatus = 1;
    order.orderStatus = "dibayar";
    order.updatedAt = new Date().toISOString();
    saveDemoStore(store);
    return { order: enrichOrder(order, store.menus) };
  }

  if (method === "PATCH" && parts[0] === "api" && parts[1] === "orders" && parts[3] === "status") {
    const order = store.orders.find(entry => entry.id === parts[2]);
    if (!order) throw new Error("Pesanan tidak ditemukan.");
    order.orderStatus = body.status;
    if (body.status !== "menunggu pembayaran") order.paymentStatus = 1;
    order.updatedAt = new Date().toISOString();
    saveDemoStore(store);
    return { order: enrichOrder(order, store.menus) };
  }

  if (method === "DELETE" && parts[0] === "api" && parts[1] === "orders" && parts[2]) {
    store.orders = store.orders.filter(order => order.id !== parts[2]);
    saveDemoStore(store);
    return { deleted: parts[2] };
  }

  if (method === "DELETE" && url.pathname === "/api/orders") {
    const tableNo = url.searchParams.get("tableNo");
    store.orders = store.orders.filter(order => order.orderStatus !== "selesai" || (tableNo && order.tableNo !== tableNo));
    saveDemoStore(store);
    return { deleted: true };
  }

  if (method === "POST" && url.pathname === "/api/menus") {
    const menu = {
      id: nextMenuId(store.menus),
      name: String(body.name || "").trim(),
      price: Math.max(0, Number(body.price) || 0),
      mood: Array.isArray(body.mood) && body.mood.length ? body.mood : ["asin"],
      category: body.category || "Makanan",
      stock: true,
      description: String(body.description || "").trim(),
      image: body.imageData || body.image || "/IMAGE_FIXX/Sampul/Background_web_halaman_kantin.jpeg",
      customizations: []
    };
    if (!menu.name || !menu.price) throw new Error("Nama menu dan harga wajib diisi.");
    store.menus.push(menu);
    saveDemoStore(store);
    return { menu };
  }

  if (method === "PATCH" && parts[0] === "api" && parts[1] === "menus" && parts[2]) {
    const menu = store.menus.find(entry => entry.id === parts[2]);
    if (!menu) throw new Error("Menu tidak ditemukan.");
    Object.assign(menu, {
      name: body.name === undefined ? menu.name : String(body.name).trim(),
      price: body.price === undefined ? menu.price : Math.max(0, Number(body.price) || 0),
      mood: body.mood === undefined ? menu.mood : (Array.isArray(body.mood) && body.mood.length ? body.mood : ["asin"]),
      category: body.category || menu.category,
      description: body.description === undefined ? menu.description : String(body.description).trim(),
      image: body.imageData || body.image || menu.image
    });
    saveDemoStore(store);
    return { menu };
  }

  if (method === "DELETE" && parts[0] === "api" && parts[1] === "menus" && parts[2]) {
    store.menus = store.menus.filter(menu => menu.id !== parts[2]);
    saveDemoStore(store);
    return { deleted: parts[2] };
  }

  throw new Error("Endpoint demo tidak ditemukan.");
}

window.demoApi = demoApi;
