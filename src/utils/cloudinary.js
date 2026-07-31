const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

function isConfigured() {
  return !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

// Uploads an in-memory buffer (never touches local disk — Render's web
// services have ephemeral disk, so anything written locally is lost on the
// next restart/redeploy). Returns { url, public_id }; public_id must be
// stored alongside the URL so the file can actually be deleted later.
function uploadBuffer(buffer, { folder, resourceType = 'auto' } = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: folder || 'tbill', resource_type: resourceType },
      (err, result) => {
        if (err) return reject(err);
        resolve({ url: result.secure_url, public_id: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

function destroyAsset(publicId, resourceType = 'image') {
  if (!publicId) return Promise.resolve();
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType }).catch((err) => {
    // Don't let a failed remote cleanup block the DB operation the user
    // actually asked for (e.g. deleting an expense) — log and move on.
    console.error('Cloudinary destroy failed for', publicId, err.message);
  });
}

// Exported as a plain object (not destructured by callers) so tests can
// monkey-patch cloudinaryUtil.uploadBuffer / destroyAsset without needing to
// reach into the real Cloudinary account.
module.exports = { uploadBuffer, destroyAsset, isConfigured, cloudinary };
