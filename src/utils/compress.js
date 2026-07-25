const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const MIN_SIZE_FOR_COMPRESSION = 200 * 1024; // 200KB

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];
const PDF_TYPES = ['application/pdf'];

async function compressImage(inputPath) {
  const stats = fs.statSync(inputPath);
  if (stats.size < MIN_SIZE_FOR_COMPRESSION) {
    return { skipped: true, reason: 'too_small' };
  }

  const ext = path.extname(inputPath);
  const outputPath = inputPath.replace(ext, '.webp');

  try {
    await sharp(inputPath)
      .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(outputPath);

    const newStats = fs.statSync(outputPath);
    fs.unlinkSync(inputPath);

    return {
      skipped: false,
      outputPath,
      originalSize: stats.size,
      compressedSize: newStats.size,
      savings: Math.round((1 - newStats.size / stats.size) * 100),
    };
  } catch (err) {
    console.error('Image compression failed:', err.message);
    return { skipped: true, reason: 'compression_error', error: err.message };
  }
}

async function compressPdf(inputPath) {
  const stats = fs.statSync(inputPath);
  if (stats.size < MIN_SIZE_FOR_COMPRESSION) {
    return { skipped: true, reason: 'too_small' };
  }

  try {
    const pdfBytes = fs.readFileSync(inputPath);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

    // Remove metadata to reduce size
    pdfDoc.setTitle('');
    pdfDoc.setAuthor('');
    pdfDoc.setSubject('');
    pdfDoc.setKeywords([]);
    pdfDoc.setProducer('');
    pdfDoc.setCreator('');

    const compressedBytes = await pdfDoc.save({ useObjectStreams: true });

    fs.writeFileSync(inputPath, compressedBytes);

    const newStats = fs.statSync(inputPath);

    return {
      skipped: false,
      outputPath: inputPath,
      originalSize: stats.size,
      compressedSize: newStats.size,
      savings: Math.round((1 - newStats.size / stats.size) * 100),
    };
  } catch (err) {
    console.error('PDF compression failed:', err.message);
    return { skipped: true, reason: 'compression_error', error: err.message };
  }
}

async function compressFile(filePath, mimeType) {
  if (IMAGE_TYPES.includes(mimeType)) {
    return compressImage(filePath);
  }
  if (PDF_TYPES.includes(mimeType)) {
    return compressPdf(filePath);
  }
  return { skipped: true, reason: 'unsupported_type' };
}

module.exports = { compressFile, compressImage, compressPdf };
