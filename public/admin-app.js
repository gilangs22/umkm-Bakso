const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const statusFlow = ["menunggu pembayaran", "dibayar", "diproses", "dimasak", "siap", "selesai"];

const state = {
    orders: [],
    menus: [],
    role: localStorage.getItem('adminRole') || 'staff',
    showOnlyTable1: true,
    tableFilter: '01'
};

const el = {
    orderList: document.querySelector("#orderList"),
    orderQueueCount: document.querySelector("#orderQueueCount"),
    filterTableBtn: document.querySelector("#filterTableBtn"),
    clearCompletedBtn: document.querySelector("#clearCompletedBtn"),
    userRoleLabel: document.querySelector("#userRoleLabel"),
    welcomeStaff: document.querySelector("#welcomeStaff"),
    toast: document.querySelector("#toast"),
    logoutBtn: document.querySelector("#logoutBtn"),
    refreshBtn: document.querySelector("#refreshOrdersBtn")
};

// Security Check
if (!localStorage.getItem('adminToken')) {
    window.location.href = '/login.html';
}

function api(path, options = {}) {
    return fetch(path, {
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        ...options
    }).then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Permintaan gagal.");
        return data;
    }).catch(error => {
        if (window.demoApi) return window.demoApi(path, options);
        throw error;
    });
}

function showToast(message) {
    el.toast.textContent = message;
    el.toast.classList.add("show");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => el.toast.classList.remove("show"), 2600);
}

async function loadData() {
    try {
        const data = await api("/api/bootstrap");
        state.orders = data.orders;
        state.menus = data.menus;
        renderAll();
    } catch (err) {
        showToast(err.message);
    }
}

function getVisibleOrders() {
    return state.orders.filter(order => !state.showOnlyTable1 || order.tableNo === state.tableFilter);
}

function updateFilterButton() {
    el.filterTableBtn.textContent = state.showOnlyTable1 ? `Tampilkan Semua Meja` : `Tampilkan Meja ${state.tableFilter}`;
}

function renderOrders() {
    const visibleOrders = getVisibleOrders();
    el.orderQueueCount.textContent = `${visibleOrders.length} pesanan`;
    el.orderList.innerHTML = visibleOrders.length ? visibleOrders.map(order => {
        const completed = order.orderStatus === "selesai";
        return `
    <article class="order-card">
      <header>
        <div>
          <strong>${order.id}</strong>
          <span>Meja ${order.tableNo} | Mood ${order.mood || "-"}</span>
        </div>
        <b>${rupiah.format(order.total)}</b>
      </header>
      <ul>${order.items.map(item => `<li>${item.qty}x ${item.menu ? item.menu.name : item.menuId}${item.note ? ` (${item.note})` : ""}</li>`).join("")}</ul>
      ${order.note ? `<p><em>Note: ${order.note}</em></p>` : ""}
      <div class="status-actions">
        ${statusFlow.slice(1).map(status => `
            <button class="${order.orderStatus === status ? "active" : ""}" 
                    data-status="${status}" 
                    data-order="${order.id}" 
                    ${completed ? "disabled" : ""}
                    type="button">${status}</button>
        `).join("")}
        <button class="ghost-btn delete-order-btn" data-delete="${order.id}" type="button">× Hapus</button>
      </div>
      ${completed ? `<p class="order-finalized">Pesanan selesai. Status tidak bisa diubah kembali.</p>` : ""}
    </article>
  `;
    }).join("") : `<div class="empty-state">Belum ada pesanan masuk.</div>`;
}

async function updateStatus(orderId, status) {
    const { order } = await api(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, updatedBy: state.role })
    });
    await loadData();
    showToast(`Status ${order.id} diubah menjadi ${status}.`);
}

async function deleteOrder(orderId) {
    const confirmed = window.confirm("Hapus pesanan ini? Data akan dihapus dari antrean dan riwayat pelanggan.");
    if (!confirmed) return;
    try {
        await api(`/api/orders/${orderId}`, { method: "DELETE" });
        await loadData();
        showToast("Pesanan berhasil dihapus.");
    } catch (error) {
        showToast(error.message);
    }
}

async function clearCompletedOrders() {
    const confirmed = window.confirm(`Bersihkan semua pesanan selesai untuk meja ${state.tableFilter}?`);
    if (!confirmed) return;
    try {
        await api(`/api/orders?cleanup=completed&tableNo=${state.tableFilter}`, { method: "DELETE" });
        await loadData();
        showToast("Pesanan selesai berhasil dibersihkan.");
    } catch (error) {
        showToast(error.message);
    }
}

function renderAll() {
    updateFilterButton();
    renderOrders();
    renderMenus();
    el.userRoleLabel.textContent = state.role.toUpperCase();
    el.welcomeStaff.textContent = `Dashboard ${state.role.charAt(0).toUpperCase() + state.role.slice(1)}`;
}

// Events
document.addEventListener("click", event => {
    const statusButton = event.target.closest("[data-status]");
    if (statusButton) {
        const targetStatus = statusButton.dataset.status;
        const orderId = statusButton.dataset.order;
        if (targetStatus === "selesai" && !statusButton.disabled) {
            const confirmed = window.confirm("Apakah Anda yakin ingin menandai pesanan ini selesai? Setelah selesai, pesanan tidak dapat diubah lagi.");
            if (!confirmed) return;
        }
        updateStatus(orderId, targetStatus).catch(error => showToast(error.message));
        return;
    }

    const deleteButton = event.target.closest("[data-delete]");
    if (deleteButton) {
        deleteOrder(deleteButton.dataset.delete).catch(error => showToast(error.message));
        return;
    }
});

document.querySelectorAll(".nav-tab").forEach(button => {
    button.addEventListener("click", () => {
        document.querySelectorAll(".nav-tab").forEach(tab => tab.classList.remove("active"));
        document.querySelectorAll(".view").forEach(view => view.classList.remove("active"));
        button.classList.add("active");
        document.querySelector(`#${button.dataset.view}View`).classList.add("active");
    });
});

el.logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminRole');
    window.location.href = '/login.html';
});

el.filterTableBtn.addEventListener('click', () => {
    state.showOnlyTable1 = !state.showOnlyTable1;
    renderAll();
});

el.clearCompletedBtn.addEventListener('click', () => clearCompletedOrders());

el.refreshBtn.addEventListener('click', () => loadData().then(() => showToast("Data diperbarui.")));

// Menu Management Functions
function readImageInput(input) {
    return new Promise((resolve, reject) => {
        if (!input || !input.files || !input.files.length) {
            resolve("");
            return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Gagal membaca gambar."));
        reader.readAsDataURL(input.files[0]);
    });
}

function collectMood(prefix) {
    return Array.from(document.querySelectorAll(`[name="${prefix}Mood"]:checked`)).map(input => input.value);
}

function renderMenus() {
    const grid = document.getElementById("menuManagementGrid");
    if (!state.menus.length) {
        grid.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;">Belum ada menu tersedia.</div>';
        return;
    }

    grid.innerHTML = state.menus.map(menu => `
        <div style="border: 1px solid #ddd; border-radius: 8px; overflow: hidden; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="position: relative; width: 100%; padding-bottom: 100%; background: #f0f0f0; overflow: hidden;">
                <img src="${menu.image || '/IMAGE_FIXX/Sampul/Background_web_halaman_kantin.jpeg'}" alt="${menu.name}" 
                     style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;">
            </div>
            <div style="padding: 12px;">
                <h4 style="margin: 0 0 4px; font-size: 1rem;">${menu.name}</h4>
                <p style="margin: 0 0 8px; font-size: 0.9rem; color: #666;">${menu.category}</p>
                <p style="margin: 0 0 12px; font-size: 1.1rem; font-weight: 600; color: #27ae60;">${rupiah.format(menu.price)}</p>
                <div style="display: flex; gap: 6px;">
                    <button class="ghost-btn" onclick="showEditMenuForm('${menu.id}')" style="flex: 1; padding: 8px; font-size: 0.85rem;">Edit</button>
                    <button class="ghost-btn" onclick="deleteMenuConfirm('${menu.id}')" style="flex: 1; padding: 8px; font-size: 0.85rem; color: #e74c3c;">Hapus</button>
                </div>
            </div>
        </div>
    `).join("");
}

function showAddMenuForm() {
    const modal = document.getElementById("menuModalOverlay");
    const content = document.getElementById("menuModalContent");
    
    content.innerHTML = `<div style="padding: 20px;">
        <h2>Tambah Menu Baru</h2>
        <form id="addMenuForm" style="display: flex; flex-direction: column; gap: 15px;">
            <div>
                <label style="display: block; font-weight: 600; margin-bottom: 6px;">Nama Menu</label>
                <input type="text" id="menuName" placeholder="Contoh: Bakso Pedas" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            <div>
                <label style="display: block; font-weight: 600; margin-bottom: 6px;">Harga (Rp)</label>
                <input type="number" id="menuPrice" placeholder="10000" min="1000" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            <div>
                <label style="display: block; font-weight: 600; margin-bottom: 6px;">Kategori</label>
                <select id="menuCategory" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    <option value="">-- Pilih Kategori --</option>
                    <option value="Makanan">Makanan</option>
                    <option value="Jajan">Jajan</option>
                    <option value="Minuman">Minuman</option>
                </select>
            </div>
            <div>
                <label style="display: block; font-weight: 600; margin-bottom: 6px;">Deskripsi</label>
                <textarea id="menuDesc" placeholder="Deskripsi menu..." style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; min-height: 60px;"></textarea>
            </div>
            <div>
                <label style="display: block; font-weight: 600; margin-bottom: 6px;">Mood Rekomendasi</label>
                <label><input type="checkbox" name="addMood" value="pedas"> Pedas</label>
                <label><input type="checkbox" name="addMood" value="asin" checked> Asin</label>
                <label><input type="checkbox" name="addMood" value="manis"> Manis</label>
                <label><input type="checkbox" name="addMood" value="segar"> Segar</label>
            </div>
            <div>
                <label style="display: block; font-weight: 600; margin-bottom: 6px;">Upload Gambar</label>
                <input type="file" id="menuImage" accept="image/*" style="width: 100%;">
            </div>
            <div style="display: flex; gap: 10px;">
                <button type="button" class="secondary-btn" onclick="closeMenuModal()" style="flex: 1;">Batal</button>
                <button type="submit" class="primary-btn" style="flex: 1;">Tambah Menu</button>
            </div>
        </form>
    </div>`;
    
    document.getElementById("addMenuForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
            const imageData = await readImageInput(document.getElementById("menuImage"));
            await api("/api/menus", {
                method: "POST",
                body: JSON.stringify({
                    name: document.getElementById("menuName").value,
                    price: Number(document.getElementById("menuPrice").value),
                    category: document.getElementById("menuCategory").value,
                    description: document.getElementById("menuDesc").value,
                    mood: collectMood("add"),
                    imageData
                })
            });
            await loadData();
            showToast("Menu baru berhasil ditambahkan.");
            closeMenuModal();
        } catch (error) {
            showToast(error.message);
        }
    });

    modal.classList.add("active");
}

function showEditMenuForm(menuId) {
    const menu = state.menus.find(m => m.id === menuId);
    if (!menu) return;

    const modal = document.getElementById("menuModalOverlay");
    const content = document.getElementById("menuModalContent");

    content.innerHTML = `<div style="padding: 20px;">
        <h2>Edit Menu: ${menu.name}</h2>
        <div style="margin-bottom: 20px; text-align: center;">
            <img src="${menu.image || '/IMAGE_FIXX/Sampul/Background_web_halaman_kantin.jpeg'}" alt="${menu.name}" 
                 style="max-width: 100%; max-height: 200px; border-radius: 8px; margin-bottom: 12px;">
            <input type="file" id="imageUpload" accept="image/*" style="width: 100%;">
            <button class="primary-btn" onclick="uploadMenuImage('${menuId}')" style="width: 100%; margin-top: 12px;">Ganti Gambar</button>
        </div>
        <form id="editMenuForm" style="display: flex; flex-direction: column; gap: 15px;">
            <div>
                <label style="display: block; font-weight: 600; margin-bottom: 6px;">Nama Menu</label>
                <input type="text" id="editMenuName" value="${menu.name}" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            <div>
                <label style="display: block; font-weight: 600; margin-bottom: 6px;">Harga (Rp)</label>
                <input type="number" id="editMenuPrice" value="${menu.price}" min="1000" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            <div>
                <label style="display: block; font-weight: 600; margin-bottom: 6px;">Kategori</label>
                <select id="editMenuCategory" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    <option value="Makanan" ${menu.category === "Makanan" ? "selected" : ""}>Makanan</option>
                    <option value="Jajan" ${menu.category === "Jajan" ? "selected" : ""}>Jajan</option>
                    <option value="Minuman" ${menu.category === "Minuman" ? "selected" : ""}>Minuman</option>
                </select>
            </div>
            <div>
                <label style="display: block; font-weight: 600; margin-bottom: 6px;">Deskripsi</label>
                <textarea id="editMenuDesc" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; min-height: 60px;">${menu.description}</textarea>
            </div>
            <div>
                <label style="display: block; font-weight: 600; margin-bottom: 6px;">Mood Rekomendasi</label>
                ${["pedas", "asin", "manis", "segar"].map(mood => `
                    <label><input type="checkbox" name="editMood" value="${mood}" ${menu.mood && menu.mood.includes(mood) ? "checked" : ""}> ${mood}</label>
                `).join("")}
            </div>
            <div style="display: flex; gap: 10px;">
                <button type="button" class="secondary-btn" onclick="closeMenuModal()" style="flex: 1;">Batal</button>
                <button type="submit" class="primary-btn" style="flex: 1;">Simpan Perubahan</button>
            </div>
        </form>
    </div>`;

    document.getElementById("editMenuForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
            await api(`/api/menus/${menuId}`, {
                method: "PATCH",
                body: JSON.stringify({
                    name: document.getElementById("editMenuName").value,
                    price: Number(document.getElementById("editMenuPrice").value),
                    category: document.getElementById("editMenuCategory").value,
                    description: document.getElementById("editMenuDesc").value,
                    mood: collectMood("edit")
                })
            });
            await loadData();
            showToast("Menu berhasil diperbarui.");
            closeMenuModal();
        } catch (error) {
            showToast(error.message);
        }
    });

    modal.classList.add("active");
}

function closeMenuModal() {
    document.getElementById("menuModalOverlay").classList.remove("active");
}

async function uploadMenuImage(menuId) {
    const fileInput = document.getElementById("imageUpload");
    if (!fileInput.files.length) {
        showToast("Pilih gambar terlebih dahulu");
        return;
    }

    try {
        const imageData = await readImageInput(fileInput);
        await api(`/api/menus/${menuId}`, {
            method: "PATCH",
            body: JSON.stringify({ imageData })
        });
        await loadData();
        showToast("Gambar menu berhasil diganti.");
        closeMenuModal();
    } catch (error) {
        showToast(error.message);
    }
}

async function deleteMenuConfirm(menuId) {
    const menu = state.menus.find(m => m.id === menuId);
    if (!menu) return;

    const confirmed = window.confirm(`Hapus menu "${menu.name}"? Tindakan ini tidak dapat dibatalkan.`);
    if (!confirmed) return;

    try {
        await api(`/api/menus/${menuId}`, { method: "DELETE" });
        await loadData();
        showToast("Menu berhasil dihapus.");
    } catch (error) {
        showToast(error.message);
    }
}

// Auto Refresh
window.setInterval(loadData, 5000);

// Init
loadData();
document.addEventListener("DOMContentLoaded", () => {
    // Rerender menus whenever view changes
    document.querySelectorAll(".nav-tab").forEach(btn => {
        btn.addEventListener("click", () => {
            if (btn.dataset.view === "menu") {
                setTimeout(() => renderMenus(), 100);
            }
        });
    });
});
