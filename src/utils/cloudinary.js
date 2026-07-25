const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

function isCloudinaryConfigured() {
  return !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

function createCloudinaryStorage() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  return new CloudinaryStorage({
    cloudinary,
    params: (req, file) => ({
      folder: 't-bill',
      resource_type: 'auto',
      public_id: Date.now() + '-' + Math.round(Math.random() * 1e6),
    }),
  });
}

function createUploadMiddleware() {
  if (isCloudinaryConfigured()) {
    console.log('Using Cloudinary for file uploads');
    const storage = createCloudinaryStorage();
    return multer({
      storage,
      fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        cb(null, allowed.includes(file.mimetype));
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    });
  }

  console.log('Using local disk for file uploads');
  const { getUploadDir } = require('./uploadPath');
  const path = require('path');
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      try {
        const dir = getUploadDir();
        cb(null, dir);
      } catch (err) {
        cb(err);
      }
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, Date.now() + '-' + Math.round(Math.random() * 1e6) + ext);
    },
  });
  return multer({
    storage,
    fileFilter: (req, file, cb) => {
      const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      cb(null, allowed.includes(file.mimetype));
    },
    limits: { fileSize: 5 * 1024 * 1024 },
  });
}

function getAttachmentUrl(file) {
  if (isCloudinaryConfigured()) {
    // Cloudinary stores the URL in file.path
    return file.path;
  }

  // Local disk — build relative URL from file path
  const pathParts = file.path.split(require('path').sep);
  const uploadsIdx = pathParts.indexOf('uploads');
  return uploadsIdx >= 0
    ? '/' + pathParts.slice(uploadsIdx).join('/')
    : '/uploads/' + file.filename;
}

function deleteFile(fileUrl) {
  if (!fileUrl) return;

  // Cloudinary URL
  if (fileUrl.includes('cloudinary.com') || fileUrl.includes('res.cloudinary')) {
    if (isCloudinaryConfigured()) {
      // Extract public_id from URL: .../t-bill/filename.ext
      const parts = fileUrl.split('/');
      const folderIdx = parts.indexOf('t-bill');
      if (folderIdx >= 0) {
        const publicId = parts.slice(folderIdx).join('/').replace(/\.[^.]+$/, '');
        cloudinary.uploader.destroy(publicId).catch(err => {
          console.error('Cloudinary delete error:', err.message);
        });
      }
    }
    return;
  }

  // Local file
  const fs = require('fs');
  const filePath = require('path').join(__dirname, '..', '..', fileUrl);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

module.exports = { isCloudinaryConfigured, createUploadMiddleware, getAttachmentUrl, deleteFile, cloudinary };
