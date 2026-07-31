const multer = require('multer');
const cloudinaryUtil = require('../utils/cloudinary');

// Only these types are accepted.
const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'application/pdf': '.pdf',
};

// Files are held in memory only, never written to local disk — Render's web
// services (and most PaaS hosts) use ephemeral disk, so anything saved
// locally disappears on the next restart/redeploy. Everything gets streamed
// straight to Cloudinary instead.
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  cb(null, Object.prototype.hasOwnProperty.call(EXT_BY_MIME, file.mimetype));
};

const rawUpload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// Magic-byte signatures for the types we accept. The client's declared
// Content-Type header is not trustworthy (it's attacker-controlled), so we
// verify the actual bytes of the in-memory buffer match what was declared
// before it ever gets uploaded to Cloudinary.
const SIGNATURES = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
];

function bufferMatchesDeclared(buffer, declaredMime) {
  const norm = declaredMime === 'image/jpg' ? 'image/jpeg' : declaredMime;
  const sig = SIGNATURES.find((s) => s.mime === norm);
  if (!sig) return false;
  return sig.bytes.every((b, i) => buffer[i] === b);
}

function collectFiles(req) {
  if (req.files) {
    return Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
  }
  return req.file ? [req.file] : [];
}

function validateContent(req, res, next) {
  const files = collectFiles(req);
  for (const f of files) {
    if (!bufferMatchesDeclared(f.buffer, f.mimetype)) {
      return res.status(400).json({ error: 'File content does not match a supported type (JPEG, PNG, or PDF).' });
    }
  }
  next();
}

// Uploads every validated in-memory buffer to Cloudinary and attaches the
// result onto each file object (file.cloudinaryUrl / file.cloudinaryPublicId)
// so route handlers can read it the same way regardless of how many files
// came in. Runs after validateContent, so only genuinely-valid files reach
// Cloudinary.
async function uploadToCloudinary(req, res, next) {
  const files = collectFiles(req);
  if (files.length === 0) return next();

  if (!cloudinaryUtil.isConfigured()) {
    return res.status(500).json({ error: 'File storage is not configured on the server (missing Cloudinary credentials).' });
  }

  try {
    await Promise.all(
      files.map(async (f) => {
        const resourceType = f.mimetype === 'application/pdf' ? 'raw' : 'image';
        const result = await cloudinaryUtil.uploadBuffer(f.buffer, { resourceType });
        f.cloudinaryUrl = result.url;
        f.cloudinaryPublicId = result.public_id;
      })
    );
    next();
  } catch (err) {
    console.error('Cloudinary upload failed:', err.message);
    res.status(502).json({ error: 'Failed to store the uploaded file. Please try again.' });
  }
}

function wrap(multerMiddleware) {
  return [multerMiddleware, validateContent, uploadToCloudinary];
}

module.exports = {
  array: (field, max) => wrap(rawUpload.array(field, max)),
  single: (field) => wrap(rawUpload.single(field)),
};
