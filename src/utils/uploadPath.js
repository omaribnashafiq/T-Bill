const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'uploads');

function getUploadDir() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dir = path.join(UPLOADS_ROOT, String(year), month, day);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function buildUploadPath(originalFilename) {
  const ext = path.extname(originalFilename);
  const base = Date.now() + '-' + Math.round(Math.random() * 1e6);
  const dir = getUploadDir();
  const filename = base + ext;
  const fullPath = path.join(dir, filename);
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const publicUrl = '/uploads/' + year + '/' + month + '/' + day + '/' + filename;
  return { dir, filename, fullPath, publicUrl };
}

function computeHash(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

module.exports = { getUploadDir, buildUploadPath, computeHash, UPLOADS_ROOT };