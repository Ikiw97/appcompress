# FileZen Backend

Backend Node.js untuk aplikasi FileZen - File Converter & Compressor.

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Konfigurasi .env
```bash
cp .env.example .env
```
Edit `.env` dan isi API keys:
- `CLOUDCONVERT_API_KEY` - dari https://cloudconvert.com/api/v2
- `ILOVEPDF_PUBLIC_KEY` + `ILOVEPDF_SECRET_KEY` - dari https://developer.ilovepdf.com

### 3. Jalankan server
```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

Server berjalan di `http://localhost:3000`

## Endpoints

### POST /convert
Konversi file (PDF ↔ Word, Image → PDF, dll.)

```
Body (multipart/form-data):
  file   : file binary
  from   : format asal (pdf, jpg, png, docx)
  to     : format tujuan (pdf, docx, jpg, png)
```

### POST /compress
Kompres file PDF atau gambar.

```
Body (multipart/form-data):
  file   : file binary
  type   : pdf | image
```

### GET /health
Health check.

## Dual-API Logic

```
Request masuk
    ↓
CloudConvert (Primary)
    ↓ Sukses → Return file
    ↓ Gagal
iLovePDF (Fallback)
    ↓ Sukses → Return file
    ↓ Gagal
Return error 500
```

## File Size Limit
Maksimal 100 MB per file.
