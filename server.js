const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const IMAGE_DIR = path.join(ROOT, "IMAGE");
const IMAGE_FIX_DIR = path.join(ROOT, "IMAGE_FIXX");
const UPLOAD_DIR = path.join(PUBLIC_DIR, "uploads");
const DATA_FILE = path.join(ROOT, "data", "store.json");

const moods = [
  { code: "pedas", label: "Pedas", tone: "Panas, berani, menggugah selera!" },
  { code: "manis", label: "Manis", tone: "Lembut, nyaman, penutup rasa yang sempurna." },
  { code: "asin", label: "Asin", tone: "Gurih, renyah, cocok untuk berbagi bareng teman." },
  { code: "segar", label: "Segar", tone: "Ringan, dingin, penyeimbang rasa yang pas." }
];

const seedMenus = [
  {
    id: "M001",
    name: "Mie Gacoan Level 4",
    price: 14500,
    mood: ["pedas", "asin"],
    category: "Makanan",
    stock: true,
    description: "Mie pedas gurih dengan topping ayam cincang dan pangsit.",
    image: "https://thumb.viva.co.id/media/frontend/thumbs3/2023/10/02/651a5611df31d-mie-gacoan_665_374.jpg"
  },
  {
    id: "M002",
    name: "Mie Hompimpa Level 2",
    price: 13500,
    mood: ["pedas"],
    category: "Makanan",
    stock: true,
    description: "Mie asin pedas ringan untuk pelanggan yang ingin tetap aman.",
    image: "https://p-id.ipricegroup.com/media/Indra/Mie_Gacoan_Mie_Hompimpa.jpg"
  },
  {
    id: "M003",
    name: "Mie Suit",
    price: 12500,
    mood: ["asin", "segar"],
    category: "Makanan",
    stock: true,
    description: "Mie gurih tanpa pedas, cocok untuk mood santai.",
    image: "https://p-id.ipricegroup.com/media/Indra/Mie_Gacoan_Mie_Suit.jpg"
  },
  {
    id: "M004",
    name: "Udang Keju",
    price: 12000,
    mood: ["asin"],
    category: "Dimsum",
    stock: true,
    description: "Dimsum renyah dengan isian udang dan keju.",
    image: "https://i0.wp.com/resepkoki.id/wp-content/uploads/2023/01/Resep-Udang-Keju-Gacoan.jpg"
  },
  {
    id: "M005",
    name: "Udang Rambutan",
    price: 12000,
    mood: ["asin"],
    category: "Dimsum",
    stock: true,
    description: "Udang bola dibalut kulit pangsit krispi.",
    image: "https://resepkoki.id/wp-content/uploads/2022/10/Resep-Udang-Rambutan.jpg"
  },
  {
    id: "M006",
    name: "Lumpia Udang",
    price: 11000,
    mood: ["asin"],
    category: "Dimsum",
    stock: true,
    description: "Lumpia hangat gurih untuk pelengkap pesanan utama.",
    image: "https://i.ytimg.com/vi/Z9N6B5uABy8/maxresdefault.jpg"
  },
  {
    id: "M007",
    name: "Es Genderuwo",
    price: 11500,
    mood: ["manis", "segar"],
    category: "Minuman",
    stock: true,
    description: "Minuman manis dingin dengan sensasi buah dan susu.",
    image: "https://p-id.ipricegroup.com/media/Indra/Mie_Gacoan_Es_Genderuwo.jpg"
  },
  {
    id: "M008",
    name: "Es Tuyul",
    price: 9500,
    mood: ["manis", "segar"],
    category: "Minuman",
    stock: true,
    description: "Minuman segar ringan untuk menutup rasa pedas.",
    image: "https://p-id.ipricegroup.com/media/Indra/Mie_Gacoan_Es_Tuyul.jpg"
  },
  {
    id: "M009",
    name: "Es Sundel Bolong",
    price: 10000,
    mood: ["manis"],
    category: "Minuman",
    stock: true,
    description: "Susu sirup mawar yang manis dan lembut.",
    image: "https://p-id.ipricegroup.com/media/Indra/Mie_Gacoan_Es_Sundel_Bolong.jpg"
  }
];

const statusFlow = ["menunggu pembayaran", "dibayar", "diproses", "dimasak", "siap", "selesai"];

function defaultStore() {
  return {
    users: [
      { id: "U001", username: "kasir", role: "kasir" },
      { id: "U002", username: "dapur", role: "dapur" },
      { id: "U003", username: "admin", role: "admin" }
    ],
    menus: seedMenus,
    orders: [],
    payments: [],
    statusLogs: []
  };
}

function normalizeStore(store) {
  const base = defaultStore();
  const users = Array.isArray(store.users) ? store.users : [];
  base.users.forEach(defaultUser => {
    if (!users.some(user => user.username === defaultUser.username)) {
      users.push(defaultUser);
    }
  });

  return {
    ...base,
    ...store,
    users,
    menus: Array.isArray(store.menus) && store.menus.length ? store.menus : base.menus,
    orders: Array.isArray(store.orders) ? store.orders : [],
    payments: Array.isArray(store.payments) ? store.payments : [],
    statusLogs: Array.isArray(store.statusLogs) ? store.statusLogs : []
  };
}

function ensureStore() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultStore(), null, 2));
  }
  const store = normalizeStore(JSON.parse(fs.readFileSync(DATA_FILE, "utf8")));
  saveStore(store);
  return store;
}

function saveStore(store) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 8_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function slugify(value) {
  return String(value || "menu")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "menu";
}

function normalizeMood(value) {
  const allowed = new Set(moods.map(mood => mood.code));
  const list = Array.isArray(value) ? value : String(value || "").split(",");
  const normalized = list.map(item => String(item).trim().toLowerCase()).filter(item => allowed.has(item));
  return normalized.length ? [...new Set(normalized)] : ["asin"];
}

function saveImageData(imageData, name) {
  if (!imageData) return "";
  const match = String(imageData).match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/i);
  if (!match) return String(imageData);
  const ext = match[1].toLowerCase().replace("jpeg", "jpg");
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const filename = `${Date.now()}-${slugify(name)}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), Buffer.from(match[2], "base64"));
  return `/uploads/${filename}`;
}

function normalizeMenuPayload(body, existing = {}) {
  const image = saveImageData(body.imageData, body.name || existing.name) || body.image || existing.image || "";
  return {
    ...existing,
    name: String(body.name || existing.name || "").trim(),
    price: Math.max(0, Number(body.price ?? existing.price) || 0),
    mood: normalizeMood(body.mood ?? existing.mood),
    category: String(body.category || existing.category || "Makanan").trim(),
    stock: body.stock === undefined ? existing.stock !== false : Boolean(body.stock),
    description: String(body.description || existing.description || "").trim(),
    image,
    customizations: Array.isArray(body.customizations) ? body.customizations : (Array.isArray(existing.customizations) ? existing.customizations : [])
  };
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

function serveStatic(req, res, pathname) {
  const isImageAsset = pathname.startsWith("/IMAGE/");
  const isImageFixAsset = pathname.startsWith("/IMAGE_FIXX/");
  const baseDir = isImageAsset ? IMAGE_DIR : (isImageFixAsset ? IMAGE_FIX_DIR : PUBLIC_DIR);
  const relativePath = isImageAsset ? pathname.replace(/^\/IMAGE\//, "") : (isImageFixAsset ? pathname.replace(/^\/IMAGE_FIXX\//, "") : pathname);
  const filePath = pathname === "/" ? path.join(PUBLIC_DIR, "index.html") : path.join(baseDir, relativePath);
  const normalized = path.normalize(filePath);
  if (!normalized.startsWith(baseDir)) {
    sendJson(res, { error: "Forbidden" }, 403);
    return;
  }
  fs.readFile(normalized, (error, content) => {
    if (error) {
      sendJson(res, { error: "Not found" }, 404);
      return;
    }
    const ext = path.extname(normalized).toLowerCase();
    const types = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg"
    };
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
    res.end(content);
  });
}

async function handleApi(req, res, url) {
  const store = ensureStore();
  const parts = url.pathname.split("/").filter(Boolean);

  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await readBody(req);
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "").trim();
    const user = store.users.find(entry => entry.username === username);

    if (!user || !password) {
      sendJson(res, { error: "Username atau password salah." }, 401);
      return;
    }

    sendJson(res, {
      user,
      token: Buffer.from(`${user.username}:${Date.now()}`).toString("base64url")
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/bootstrap") {
    sendJson(res, { moods, menus: store.menus, orders: store.orders.map(order => enrichOrder(order, store.menus)) });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/menus") {
    const mood = url.searchParams.get("mood");
    const menus = mood ? store.menus.filter(menu => menu.stock && menu.mood.includes(mood)) : store.menus;
    sendJson(res, { menus });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/menus") {
    const body = await readBody(req);
    const menu = normalizeMenuPayload(body);
    if (!menu.name || !menu.price) {
      sendJson(res, { error: "Nama menu dan harga wajib diisi." }, 400);
      return;
    }
    const maxId = store.menus.reduce((max, item) => {
      const number = Number(String(item.id || "").replace(/\D/g, ""));
      return Number.isFinite(number) ? Math.max(max, number) : max;
    }, 0);
    menu.id = `M${String(maxId + 1).padStart(3, "0")}`;
    store.menus.push(menu);
    saveStore(store);
    sendJson(res, { menu }, 201);
    return;
  }

  if (req.method === "PATCH" && parts[0] === "api" && parts[1] === "menus" && parts[2]) {
    const index = store.menus.findIndex(menu => menu.id === parts[2]);
    if (index === -1) {
      sendJson(res, { error: "Menu tidak ditemukan." }, 404);
      return;
    }
    const body = await readBody(req);
    const menu = normalizeMenuPayload(body, store.menus[index]);
    if (!menu.name || !menu.price) {
      sendJson(res, { error: "Nama menu dan harga wajib diisi." }, 400);
      return;
    }
    store.menus[index] = menu;
    saveStore(store);
    sendJson(res, { menu });
    return;
  }

  if (req.method === "DELETE" && parts[0] === "api" && parts[1] === "menus" && parts[2]) {
    const index = store.menus.findIndex(menu => menu.id === parts[2]);
    if (index === -1) {
      sendJson(res, { error: "Menu tidak ditemukan." }, 404);
      return;
    }
    const [deleted] = store.menus.splice(index, 1);
    saveStore(store);
    sendJson(res, { deleted: deleted.id });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/orders") {
    const body = await readBody(req);
    if (!body.sessionId || !Array.isArray(body.items) || body.items.length === 0) {
      sendJson(res, { error: "Sesi dan item pesanan wajib diisi." }, 400);
      return;
    }
    const items = body.items
      .map(item => ({ menuId: item.menuId, qty: Math.max(1, Number(item.qty) || 1), note: String(item.note || "") }))
      .filter(item => store.menus.some(menu => menu.id === item.menuId && menu.stock));
    if (items.length === 0) {
      sendJson(res, { error: "Tidak ada menu tersedia dalam pesanan." }, 400);
      return;
    }
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
    store.statusLogs.unshift({
      id: `LOG-${Date.now()}`,
      orderId: order.id,
      status: order.orderStatus,
      updatedBy: "sistem",
      updatedAt: order.updatedAt
    });
    saveStore(store);
    sendJson(res, { order: enrichOrder(order, store.menus) }, 201);
    return;
  }

  if (req.method === "DELETE" && parts[0] === "api" && parts[1] === "orders" && parts.length === 3) {
    const orderIndex = store.orders.findIndex(entry => entry.id === parts[2]);
    if (orderIndex === -1) {
      sendJson(res, { error: "Pesanan tidak ditemukan." }, 404);
      return;
    }
    const deletedId = store.orders[orderIndex].id;
    store.orders.splice(orderIndex, 1);
    store.payments = store.payments.filter(payment => payment.orderId !== deletedId);
    store.statusLogs = store.statusLogs.filter(log => log.orderId !== deletedId);
    saveStore(store);
    sendJson(res, { deleted: deletedId });
    return;
  }

  if (req.method === "DELETE" && parts[0] === "api" && parts[1] === "orders" && parts.length === 2) {
    const cleanup = url.searchParams.get("cleanup");
    const tableNo = url.searchParams.get("tableNo");
    if (cleanup === "completed") {
      const deletedIds = store.orders.filter(order => order.orderStatus === "selesai" && (!tableNo || order.tableNo === tableNo)).map(order => order.id);
      store.orders = store.orders.filter(order => !deletedIds.includes(order.id));
      store.payments = store.payments.filter(payment => !deletedIds.includes(payment.orderId));
      store.statusLogs = store.statusLogs.filter(log => !deletedIds.includes(log.orderId));
      saveStore(store);
      sendJson(res, { deleted: deletedIds });
      return;
    }
  }

  if (req.method === "POST" && parts[0] === "api" && parts[1] === "orders" && parts[3] === "pay") {
    const order = store.orders.find(entry => entry.id === parts[2]);
    if (!order) {
      sendJson(res, { error: "Pesanan tidak ditemukan." }, 404);
      return;
    }
    const body = await readBody(req);
    const enriched = enrichOrder(order, store.menus);
    order.paymentStatus = 1;
    order.orderStatus = "dibayar";
    order.updatedAt = new Date().toISOString();
    store.payments.unshift({
      id: `PAY-${Date.now()}`,
      orderId: order.id,
      method: body.method || "qris",
      amount: enriched.total,
      status: "lunas",
      ref: `REF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      paidAt: order.updatedAt
    });
    store.statusLogs.unshift({ id: `LOG-${Date.now()}`, orderId: order.id, status: order.orderStatus, updatedBy: "kasir", updatedAt: order.updatedAt });
    saveStore(store);
    sendJson(res, { order: enrichOrder(order, store.menus) });
    return;
  }

  if (req.method === "PATCH" && parts[0] === "api" && parts[1] === "orders" && parts[3] === "status") {
    const order = store.orders.find(entry => entry.id === parts[2]);
    if (!order) {
      sendJson(res, { error: "Pesanan tidak ditemukan." }, 404);
      return;
    }
    if (order.orderStatus === "selesai") {
      sendJson(res, { error: "Pesanan sudah selesai dan tidak dapat diubah." }, 409);
      return;
    }
    const body = await readBody(req);
    if (!statusFlow.includes(body.status)) {
      sendJson(res, { error: "Status tidak valid." }, 400);
      return;
    }
    order.orderStatus = body.status;
    if (body.status !== "menunggu pembayaran") order.paymentStatus = 1;
    order.updatedAt = new Date().toISOString();
    store.statusLogs.unshift({
      id: `LOG-${Date.now()}`,
      orderId: order.id,
      status: order.orderStatus,
      updatedBy: body.updatedBy || "dapur",
      updatedAt: order.updatedAt
    });
    saveStore(store);
    sendJson(res, { order: enrichOrder(order, store.menus) });
    return;
  }

  if (req.method === "GET" && parts[0] === "api" && parts[1] === "orders" && parts[2]) {
    const order = store.orders.find(entry => entry.id === parts[2]);
    if (!order) {
      sendJson(res, { error: "Pesanan tidak ditemukan." }, 404);
      return;
    }
    sendJson(res, { order: enrichOrder(order, store.menus), logs: store.statusLogs.filter(log => log.orderId === order.id) });
    return;
  }

  sendJson(res, { error: "Endpoint tidak ditemukan." }, 404);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    handleApi(req, res, url).catch(error => {
      sendJson(res, { error: error.message || "Server error" }, 500);
    });
    return;
  }
  serveStatic(req, res, decodeURIComponent(url.pathname));
});

server.listen(PORT, () => {
  ensureStore();
  console.log(`Mood Gacoan berjalan di http://localhost:${PORT}`);
});
