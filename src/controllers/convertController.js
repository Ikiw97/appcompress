const conversionManager = require('../services/conversionManager');
const { getMimeType, generateOutputFileName, validateConversion } = require('../utils/fileHelper');

/**
 * POST /convert
 * Body (multipart): file, from, to
 */
async function convertFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { from, to } = req.body;
    if (!from || !to) {
      return res.status(400).json({ error: 'Missing from/to format parameters' });
    }

    const validation = validateConversion(from, to);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.message });
    }

    const fileName = req.file.originalname;
    const fileBuffer = req.file.buffer;

    console.log(`[Convert] ${fileName} | ${from} → ${to} | Size: ${(fileBuffer.length / 1024).toFixed(1)} KB`);

    const resultBuffer = await conversionManager.convertFile(fileBuffer, fileName, from, to);

    const outputFileName = generateOutputFileName(fileName, to);
    const mimeType = getMimeType(to);

    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${outputFileName}"`,
      'Content-Length': resultBuffer.length,
    });

    return res.send(resultBuffer);
  } catch (err) {
    console.error('[Convert] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { convertFile };
