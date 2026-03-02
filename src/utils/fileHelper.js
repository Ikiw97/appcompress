const { v4: uuidv4 } = require('uuid');
const path = require('path');

/**
 * Format bytes into human-readable size
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get MIME type from extension
 */
function getMimeType(ext) {
  const map = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  };
  return map[ext.toLowerCase()] || 'application/octet-stream';
}

/**
 * Generate a unique filename for the output
 */
function generateOutputFileName(originalName, outputFormat) {
  const baseName = path.basename(originalName, path.extname(originalName));
  return `${baseName}_${uuidv4().slice(0, 8)}.${outputFormat}`;
}

/**
 * Validate input/output format combination
 */
function validateConversion(fromFormat, toFormat) {
  const validCombinations = {
    jpg: ['pdf'],
    jpeg: ['pdf'],
    png: ['pdf'],
    webp: ['pdf'],
    pdf: ['jpg', 'png', 'docx', 'pdf'],
    docx: ['pdf'],
    doc: ['pdf'],
  };

  const allowed = validCombinations[fromFormat.toLowerCase()];
  if (!allowed) return { valid: false, message: `Unsupported input format: ${fromFormat}` };
  if (!allowed.includes(toFormat.toLowerCase())) {
    return { valid: false, message: `Cannot convert ${fromFormat} to ${toFormat}` };
  }
  return { valid: true };
}

module.exports = { formatBytes, getMimeType, generateOutputFileName, validateConversion };
