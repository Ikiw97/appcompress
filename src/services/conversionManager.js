const cloudconvert = require('./cloudconvertService');
const ilovepdf = require('./ilovepdfService');

/**
 * Dual-API Conversion Manager
 * Flow: Try CloudConvert → If fail, try iLovePDF → If fail, return error
 */

async function convertFile(fileBuffer, fileName, inputFormat, outputFormat) {
  console.log(`[ConversionManager] Converting ${fileName}: ${inputFormat} → ${outputFormat}`);

  // Try CloudConvert first
  try {
    console.log('[ConversionManager] Trying CloudConvert...');
    const result = await cloudconvert.convertFile(fileBuffer, fileName, inputFormat, outputFormat);
    console.log('[ConversionManager] CloudConvert success ✅');
    return result;
  } catch (ccErr) {
    console.warn(`[ConversionManager] CloudConvert failed: ${ccErr.message}. Falling back to iLovePDF...`);
  }

  // Fallback to iLovePDF
  try {
    console.log('[ConversionManager] Trying iLovePDF...');
    const result = await ilovepdf.convertFile(fileBuffer, fileName, inputFormat, outputFormat);
    console.log('[ConversionManager] iLovePDF success ✅');
    return result;
  } catch (ilErr) {
    console.error(`[ConversionManager] iLovePDF also failed: ${ilErr.message}`);
    throw new Error(`Conversion failed on all APIs: ${ilErr.message}`);
  }
}

async function compressPdf(fileBuffer, fileName) {
  console.log(`[ConversionManager] Compressing PDF: ${fileName}`);

  try {
    console.log('[ConversionManager] Trying CloudConvert for PDF compress...');
    const result = await cloudconvert.compressPdf(fileBuffer, fileName);
    console.log('[ConversionManager] CloudConvert PDF compress success ✅');
    return result;
  } catch (ccErr) {
    console.warn(`[ConversionManager] CloudConvert compress failed: ${ccErr.message}. Falling back to iLovePDF...`);
  }

  try {
    console.log('[ConversionManager] Trying iLovePDF for PDF compress...');
    const result = await ilovepdf.compressPdf(fileBuffer, fileName);
    console.log('[ConversionManager] iLovePDF PDF compress success ✅');
    return result;
  } catch (ilErr) {
    console.error(`[ConversionManager] iLovePDF compress also failed: ${ilErr.message}`);
    throw new Error(`PDF compression failed on all APIs: ${ilErr.message}`);
  }
}

async function compressImage(fileBuffer, fileName) {
  console.log(`[ConversionManager] Compressing image: ${fileName}`);

  // For image compression, we use CloudConvert (convert to same format with quality reduction)
  const ext = fileName.split('.').pop().toLowerCase() || 'jpg';
  try {
    const result = await cloudconvert.convertFile(fileBuffer, fileName, ext, ext);
    return result;
  } catch (err) {
    throw new Error(`Image compression failed: ${err.message}`);
  }
}

module.exports = { convertFile, compressPdf, compressImage };
