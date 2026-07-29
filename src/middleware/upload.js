const multer = require('multer');
const fs = require('fs');
const { getUploadDir } = require('../utils/uploadPath');

// Only these types are accepted. The extension used on disk is pinned to this
// map — we never trust path.extname(file.originalname), since a client can
// name a file "receipt.jpg" while claiming any mimetype it likes, or vice versa.
const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'application/pdf': '.pdf',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      cb(null, getUploadDir());
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const ext = EXT_BY_MIME[file.mimetype] || '.bin';
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e6) + ext);
  },
});

const fileFilter = (req, file, cb) => {
  cb(null, Object.prototype.hasOwnProperty.call(EXT_BY_MIME, file.mimetype));
};

const rawUpload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// Magic-byte signatures for the types we accept. The client's declared
// Content-Type header is not trustworthy (it's attacker-controlled), so after
// multer saves the file we verify the actual bytes on disk match what was
// declared before letting the request proceed.
const SIGNATURES = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
];

function sniffMatchesDeclared(filePath, declaredMime) {
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(8);
    fs.readSync(fd, buf, 0, 8, 0);
    const norm = declaredMime === 'image/jpg' ? 'image/jpeg' : declaredMime;
    const sig = SIGNATURES.find((s) => s.mime === norm);
    if (!sig) return false;
    return sig.bytes.every((b, i) => buf[i] === b);
  } catch (err) {
    return false;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
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
    if (!sniffMatchesDeclared(f.path, f.mimetype)) {
      files.forEach((cleanup) => fs.unlink(cleanup.path, () => {}));
      return res.status(400).json({ error: 'File content does not match a supported type (JPEG, PNG, or PDF).' });
    }
  }
  next();
}

function wrap(multerMiddleware) {
  return [multerMiddleware, validateContent];
}

module.exports = {
  array: (field, max) => wrap(rawUpload.array(field, max)),
  single: (field) => wrap(rawUpload.single(field)),
};
