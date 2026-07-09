# Mood Gacoan Self-Order

Aplikasi full-stack ringan untuk rancangan "Sistem Pemesanan dan Rekomendasi Menu Berbasis Mood pada Layanan QR Self-Order".

## Fitur

- Sesi pelanggan berbasis QR meja tanpa login.
- Pemilihan mood: pedas, manis, asin, dan segar.
- Rekomendasi menu berdasarkan mood dan filter kategori.
- Keranjang, catatan pesanan, checkout, dan pembayaran QRIS/kasir.
- Dashboard kasir/dapur untuk memantau dan mengubah status pesanan.
- Penyimpanan lokal JSON sesuai konsep tabel `USERS`, `MENUS`, `ORDERS`, `PAYMENTS`, dan `ORDER_STATUS_LOGS`.

## Menjalankan

```bash
npm start
```

Buka:

```text
http://localhost:3000
```

Untuk simulasi QR meja tertentu:

```text
http://localhost:3000?meja=07
```

Server akan membuat `data/store.json` otomatis saat pertama kali dijalankan.
