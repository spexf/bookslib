# BooksLib - Your Simple CRUD Book Library Management

**BooksLib** adalah aplikasi manajemen perpustakaan modern berbasis arsitektur mikroservis. Proyek ini mendemonstrasikan integrasi berbagai *stack* teknologi populer dalam satu ekosistem yang diorkestrasi menggunakan Docker.

## 🏗️ Arsitektur Sistem

Aplikasi ini dibagi menjadi beberapa layanan independen yang berkomunikasi melalui API:

| Layanan | Teknologi | Fungsi Utama | Port |
| --- | --- | --- | --- |
| **Frontend** | ReactJS (Vite) | Antarmuka pengguna dengan tema monokrom. | `3000` |
| **Auth Service** | Golang | Menangani registrasi user, login, dan manajemen identitas. | `8081` |
| **Books Service** | .NET 8 Core | Mengelola data buku (Tambah, Lihat, Hapus, Cari). | `8082` |
| **Reviews Service** | Python Django | Mengelola ulasan dan rating untuk setiap buku. | `8083` |
| **Database** | PostgreSQL 15 | Penyimpanan data relasional terpusat. | `5432` |

---

## 🚀 Fitur Utama

* **Manajemen Akun**: Registrasi pengguna baru dan autentikasi masuk.
* **Manajemen Katalog**: Operasi CRUD (Create, Read, Delete) untuk koleksi buku.
* **Pencarian Pintar**: Fitur pencarian buku berdasarkan judul.
* **Sistem Ulasan**: Pengguna dapat memberikan ulasan teks dan rating bintang pada buku.
* **Infrastruktur Otomatis**: Migrasi database dan pembuatan tabel dilakukan otomatis saat aplikasi dijalankan.
* **Data Persisten**: Menggunakan Docker Volume untuk memastikan data tidak hilang saat kontainer dihentikan.

---

## 📁 Struktur Folder

```text
bookslib/
├── auth-service/       # Backend service berbasis Go
├── books-service/      # Backend service berbasis .NET 8
├── reviews-service/    # Backend service berbasis Django
├── frontend/           # Aplikasi Client berbasis React
├── init.sql            # Script awal untuk skema database
├── docker-compose.yml  # Konfigurasi Docker Compose
└── .env                # Konfigurasi variabel lingkungan

```

---

## 🛠️ Cara Menjalankan Aplikasi

### 1. Prasyarat

Pastikan Anda sudah menginstal **Docker** dan **Docker Compose** di mesin Anda.

### 2. Konfigurasi

Aplikasi menggunakan variabel lingkungan untuk koneksi antar servis. Pastikan file `.env` di root dan `frontend/.env` sudah terkonfigurasi (default sudah tersedia untuk dijalankan di lokal).

### 3. Menjalankan Kontainer

Jalankan perintah berikut di terminal pada direktori root proyek:

```bash
docker compose up -d --build
```

Docker akan secara otomatis melakukan:

1. Pembangunan *image* untuk setiap servis.
2. Menjalankan *unit test* di dalam tahap *build*.
3. Menjalankan PostgreSQL dan menunggu hingga statusnya *healthy*.
4. Menjalankan semua servis backend dan frontend.

### 4. Akses Aplikasi

Buka peramban Anda dan akses:

* **Web UI**: `http://localhost:3000`
* **Default Login**: Username: `admin`, Password: `password`

---

## 🧪 Pengujian (Unit Testing)

Setiap mikroservis dilengkapi dengan *unit test* sederhana untuk memastikan logika dasar berjalan dengan benar. Pengujian dijalankan otomatis saat proses `docker build`.

* **Go**: `go test`
* **React**: `vitest`
* **Django**: `python manage.py test`
* **.NET**: Console-based validation

---

## ⚙️ Variabel Lingkungan (.env)

| Variabel | Deskripsi |
| --- | --- |
| `POSTGRES_USER` | Username untuk database PostgreSQL. |
| `POSTGRES_PASSWORD` | Password untuk database PostgreSQL. |
| `VITE_AUTH_API` | URL endpoint untuk Auth Service. |
| `VITE_BOOKS_API` | URL endpoint untuk Books Service. |
| `VITE_REVIEWS_API` | URL endpoint untuk Reviews Service. |

---

**BooksLib** dibuat dengan prinsip kesederhanaan (*KISS*) dan kemudahan *deployment* sebagai referensi arsitektur mikroservis bagi pengembang.