const axios = require('axios');
const FormData = require('form-data');

const BASE_URL = 'https://api.cloudconvert.com/v2';

// ─────────────────────────────────────────────────────────────────────────────
// Multi-Key Manager
// Baca semua API key dari env: CLOUDCONVERT_API_KEY_1, _2, _3, dst.
// Juga tetap support CLOUDCONVERT_API_KEY tunggal untuk backward-compatibility.
// ─────────────────────────────────────────────────────────────────────────────
class ApiKeyManager {
  constructor() {
    this.keys = this._loadKeys();
    this.currentIndex = 0;
    this.exhaustedKeys = new Set(); // keys yang sudah kena limit

    if (this.keys.length === 0) {
      throw new Error(
        'Tidak ada CloudConvert API key ditemukan! ' +
        'Tambahkan CLOUDCONVERT_API_KEY_1, _2, dst. di file .env'
      );
    }

    console.log(`[KeyManager] Loaded ${this.keys.length} CloudConvert API key(s)`);
  }

  _loadKeys() {
    const keys = [];

    // Support multiple keys: CLOUDCONVERT_API_KEY_1, _2, _3, ...
    let i = 1;
    while (process.env[`CLOUDCONVERT_API_KEY_${i}`]) {
      keys.push({
        index: i,
        key: process.env[`CLOUDCONVERT_API_KEY_${i}`],
        label: `Key-${i}`,
      });
      i++;
    }

    // Fallback: CLOUDCONVERT_API_KEY tunggal (format lama)
    if (keys.length === 0 && process.env.CLOUDCONVERT_API_KEY) {
      keys.push({
        index: 1,
        key: process.env.CLOUDCONVERT_API_KEY,
        label: 'Key-1 (single)',
      });
    }

    return keys;
  }

  /**
   * Dapatkan key yang sedang aktif
   */
  getCurrentKey() {
    return this.keys[this.currentIndex];
  }

  /**
   * Tandai key saat ini sebagai limit, lalu pindah ke key berikutnya.
   * Kembalikan key baru, atau null jika semua keys sudah exhausted.
   */
  markLimitedAndRotate() {
    const current = this.keys[this.currentIndex];
    this.exhaustedKeys.add(current.label);
    console.warn(`[KeyManager] ${current.label} kena limit! Mencari key berikutnya...`);

    // Cari key berikutnya yang belum exhausted
    for (let i = 1; i <= this.keys.length; i++) {
      const nextIndex = (this.currentIndex + i) % this.keys.length;
      const next = this.keys[nextIndex];
      if (!this.exhaustedKeys.has(next.label)) {
        this.currentIndex = nextIndex;
        console.log(`[KeyManager] Beralih ke ${next.label}`);
        return next;
      }
    }

    // Semua keys exhausted
    console.error('[KeyManager] Semua CloudConvert API keys sudah kena limit!');
    return null;
  }

  /**
   * Reset status semua keys (misalnya dipanggil setiap hari saat limit reset)
   */
  resetExhausted() {
    this.exhaustedKeys.clear();
    this.currentIndex = 0;
    console.log('[KeyManager] Semua key direset. Mulai dari awal.');
  }

  get activeCount() {
    return this.keys.length - this.exhaustedKeys.size;
  }

  get totalCount() {
    return this.keys.length;
  }

  getStatus() {
    return this.keys.map((k) => ({
      label: k.label,
      limited: this.exhaustedKeys.has(k.label),
      active: !this.exhaustedKeys.has(k.label),
    }));
  }
}

// Singleton instance
const keyManager = new ApiKeyManager();

// Expose key manager status via endpoint (optional)
function getKeyStatus() {
  return {
    total: keyManager.totalCount,
    active: keyManager.activeCount,
    keys: keyManager.getStatus(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Error checker: apakah error ini berarti key kena limit?
// ─────────────────────────────────────────────────────────────────────────────
function isLimitError(error) {
  const status = error?.response?.status;
  // 402 = Payment Required (menit habis)
  // 429 = Too Many Requests (rate limit)
  return status === 402 || status === 429;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core: Jalankan CloudConvert job dengan key rotation otomatis
// ─────────────────────────────────────────────────────────────────────────────
async function runJobWithRotation(jobPayload, fileBuffer, fileName) {
  let lastError = null;

  // Coba semua keys yang tersedia
  for (let attempt = 0; attempt < keyManager.totalCount; attempt++) {
    const currentKey = keyManager.getCurrentKey();
    if (!currentKey) break;

    try {
      console.log(`[CloudConvert] Mencoba dengan ${currentKey.label}...`);
      return await _executeJob(currentKey.key, jobPayload, fileBuffer, fileName);
    } catch (err) {
      lastError = err;

      if (isLimitError(err)) {
        // Key ini kena limit, coba key berikutnya
        const nextKey = keyManager.markLimitedAndRotate();
        if (!nextKey) {
          throw new Error(
            `Semua ${keyManager.totalCount} CloudConvert API key telah mencapai limit harian. ` +
            'Tunggu hingga reset besok atau tambah API key baru.'
          );
        }
        continue; // retry dengan key baru
      }

      // Error lain (bukan limit) — langsung lempar error
      throw err;
    }
  }

  throw lastError || new Error('Semua CloudConvert API keys gagal');
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: Execute satu job dengan key tertentu
// ─────────────────────────────────────────────────────────────────────────────
async function _executeJob(apiKey, jobPayload, fileBuffer, fileName) {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  // 1. Buat job
  const jobResponse = await axios.post(`${BASE_URL}/jobs`, jobPayload, { headers });
  const job = jobResponse.data.data;

  // 2. Upload file
  const uploadTask = job.tasks.find((t) => t.name === 'upload-file');
  const uploadUrl = uploadTask.result.form.url;
  const uploadParams = uploadTask.result.form.parameters;

  const uploadForm = new FormData();
  Object.entries(uploadParams).forEach(([key, val]) => uploadForm.append(key, val));
  uploadForm.append('file', fileBuffer, { filename: fileName });

  await axios.post(uploadUrl, uploadForm, {
    headers: uploadForm.getHeaders(),
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  // 3. Poll sampai selesai (max 60 detik = 30 × 2 detik)
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const statusRes = await axios.get(`${BASE_URL}/jobs/${job.id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const jobData = statusRes.data.data;

    if (jobData.status === 'finished') {
      // 4. Download hasil
      const exportTask = jobData.tasks.find((t) => t.name === 'export-file');
      const fileUrl = exportTask.result.files[0].url;
      const downloadRes = await axios.get(fileUrl, { responseType: 'arraybuffer' });
      return Buffer.from(downloadRes.data);
    }

    if (jobData.status === 'error') {
      const errMsg = jobData.tasks?.find((t) => t.status === 'error')?.message || 'Unknown error';
      throw new Error(`CloudConvert job error: ${errMsg}`);
    }
  }

  throw new Error('CloudConvert job timeout setelah 60 detik');
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert file dengan multi-key rotation
 */
async function convertFile(fileBuffer, fileName, inputFormat, outputFormat) {
  const payload = {
    tasks: {
      'upload-file': { operation: 'import/upload' },
      'convert-file': {
        operation: 'convert',
        input: 'upload-file',
        input_format: inputFormat,
        output_format: outputFormat,
      },
      'export-file': {
        operation: 'export/url',
        input: 'convert-file',
      },
    },
  };

  return runJobWithRotation(payload, fileBuffer, fileName);
}

/**
 * Compress PDF dengan multi-key rotation
 */
async function compressPdf(fileBuffer, fileName) {
  const payload = {
    tasks: {
      'upload-file': { operation: 'import/upload' },
      'optimize-pdf': {
        operation: 'optimize',
        input: 'upload-file',
        input_format: 'pdf',
        profile: 'web',
      },
      'export-file': {
        operation: 'export/url',
        input: 'optimize-pdf',
      },
    },
  };

  return runJobWithRotation(payload, fileBuffer, fileName);
}

module.exports = { convertFile, compressPdf, getKeyStatus };
