const conversionManager = require('../services/conversionManager');
const { getMimeType, generateOutputFileName } = require('../utils/fileHelper');

/**
 * POST /compress
 * Body (multipart): file, type ('pdf' | 'image')
 */
async function compressFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { type } = req.body;
    if (!type || !['pdf', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing or invalid type parameter (pdf | image)' });
    }

    const fileName = req.file.originalname;
    const fileBuffer = req.file.buffer;

    console.log(`[Compress] ${fileName} | Type: ${type} | Size: ${(fileBuffer.length / 1024).toFixed(1)} KB`);

    let resultBuffer;
    if (type === 'pdf') {
      resultBuffer = await conversionManager.compressPdf(fileBuffer, fileName);
    } else {
      resultBuffer = await conversionManager.compressImage(fileBuffer, fileName);
    }

    const ext = fileName.split('.').pop();
    const outputFileName = generateOutputFileName(fileName, ext);
    const mimeType = getMimeType(ext);

    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${outputFileName}"`,
      'Content-Length': resultBuffer.length,
      'X-Original-Size': fileBuffer.length,
      'X-Result-Size': resultBuffer.length,
    });

    return res.send(resultBuffer);
  } catch (err) {
    console.error('[Compress] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { compressFile };
