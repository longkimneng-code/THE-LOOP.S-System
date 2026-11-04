// ============================================================================
// THE LOOPS UNIVERSAL RETAIL SUITE — SECURE IMAGE UPLOAD & STORAGE SERVICE
// Supports JPG, JPEG, PNG, WEBP with size validation, deduplication & previews
// ============================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOADS_DIR = path.resolve(__dirname, '../../data/uploads');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const ALLOWED_MIME_TYPES = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

/**
 * Handle Base64 or binary data URI image upload
 */
function saveBase64Image(dataUriOrBase64, filenameHint = 'product') {
  if (!dataUriOrBase64 || typeof dataUriOrBase64 !== 'string') {
    return { ok: false, error: 'No image data provided' };
  }

  let mimeType = 'image/jpeg';
  let base64Data = dataUriOrBase64;

  if (dataUriOrBase64.startsWith('data:')) {
    const matches = dataUriOrBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return { ok: false, error: 'Invalid data URI image format' };
    }
    mimeType = matches[1].toLowerCase();
    base64Data = matches[2];
  }

  const ext = ALLOWED_MIME_TYPES[mimeType];
  if (!ext) {
    return { ok: false, error: `Unsupported image format (${mimeType}). Allowed: JPG, PNG, WEBP.` };
  }

  const buffer = Buffer.from(base64Data, 'base64');
  if (buffer.length > MAX_FILE_SIZE) {
    return { ok: false, error: `File too large (${(buffer.length / (1024 * 1024)).toFixed(1)}MB). Max allowed: 5MB.` };
  }

  // Deduplicate by content hash
  const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
  const cleanFilename = `${hash}${ext}`;
  const filePath = path.join(UPLOADS_DIR, cleanFilename);

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, buffer);
  }

  const publicUrl = `/uploads/${cleanFilename}`;

  return {
    ok: true,
    url: publicUrl,
    filename: cleanFilename,
    size: buffer.length,
    mimeType
  };
}

module.exports = {
  saveBase64Image,
  UPLOADS_DIR,
  MAX_FILE_SIZE
};

