const { compressFile } = require('./compress');
const db = require('../db');

const queue = [];
let processing = false;

function enqueue({ filePath, mimeType, entityType, entityId, attachmentId }) {
  queue.push({ filePath, mimeType, entityType, entityId, attachmentId });
  if (!processing) {
    setImmediate(() => processNext());
  }
}

async function processNext() {
  if (queue.length === 0) {
    processing = false;
    return;
  }
  processing = true;
  const item = queue.shift();

  try {
    const result = await compressFile(item.filePath, item.mimeType);

    if (!result.skipped && result.outputPath) {
      const pathParts = item.filePath.split(require('path').sep);
      const uploadsIdx = pathParts.indexOf('uploads');
      if (uploadsIdx >= 0) {
        const relativeParts = pathParts.slice(uploadsIdx);
        const newUrl = '/' + relativeParts.join('/');

        await db('attachments')
          .where({ id: item.attachmentId })
          .update({
            file_url: newUrl,
            file_type: (item.mimeType === 'image/jpeg' || item.mimeType === 'image/png' || item.mimeType === 'image/jpg')
              ? 'image/webp'
              : item.mimeType,
          });

        console.log('[compress] ' + item.entityType + '#' + item.entityId +
          ' attachment#' + item.attachmentId + ': ' +
          result.originalSize + 'B -> ' + result.compressedSize + 'B (' + result.savings + '% saved)');
      }
    } else if (result.skipped) {
      console.log('[compress] ' + item.entityType + '#' + item.entityId +
        ' attachment#' + item.attachmentId + ': skipped (' + result.reason + ')');
    }
  } catch (err) {
    console.error('[compress] Failed for attachment#' + item.attachmentId + ':', err.message);
  }

  if (queue.length > 0) {
    setImmediate(() => processNext());
  } else {
    processing = false;
  }
}

function getQueueSize() {
  return queue.length;
}

module.exports = { enqueue, getQueueSize };