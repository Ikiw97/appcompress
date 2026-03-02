const axios = require('axios');
const FormData = require('form-data');

const PUBLIC_KEY = process.env.ILOVEPDF_PUBLIC_KEY;
const SECRET_KEY = process.env.ILOVEPDF_SECRET_KEY;
const BASE_URL = 'https://api.ilovepdf.com/v1';

/**
 * Get iLovePDF auth token
 */
async function getToken() {
  const res = await axios.post(`${BASE_URL}/auth`, { public_key: PUBLIC_KEY });
  return res.data.token;
}

/**
 * Start an iLovePDF task
 */
async function startTask(token, tool) {
  const res = await axios.get(`${BASE_URL}/start/${tool}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data; // { server, task }
}

/**
 * Add a file to the task
 */
async function addFile(token, server, task, fileBuffer, fileName) {
  const form = new FormData();
  form.append('task', task);
  form.append('file', fileBuffer, { filename: fileName });

  const res = await axios.post(`https://${server}/v1/upload`, form, {
    headers: {
      ...form.getHeaders(),
      Authorization: `Bearer ${token}`,
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });
  return res.data.server_filename;
}

/**
 * Process the iLovePDF task
 */
async function processTask(token, server, task, serverFileName, options = {}) {
  const body = {
    task,
    tool: options.tool,
    files: [{ server_filename: serverFileName, filename: options.fileName || 'file' }],
    ...options.params,
  };

  await axios.post(`https://${server}/v1/process`, body, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Download the result from iLovePDF
 */
async function downloadResult(token, server, task) {
  const res = await axios.get(`https://${server}/v1/download/${task}`, {
    headers: { Authorization: `Bearer ${token}` },
    responseType: 'arraybuffer',
  });
  return Buffer.from(res.data);
}

/**
 * Convert file using iLovePDF
 */
async function convertFile(fileBuffer, fileName, inputFormat, outputFormat) {
  let tool;
  if (inputFormat === 'pdf' && outputFormat === 'docx') tool = 'pdftodocx';
  else if (inputFormat === 'pdf' && (outputFormat === 'jpg' || outputFormat === 'png')) tool = 'pdftoimages';
  else if ((inputFormat === 'docx' || inputFormat === 'doc') && outputFormat === 'pdf') tool = 'officepdf';
  else if ((inputFormat === 'jpg' || inputFormat === 'png' || inputFormat === 'webp') && outputFormat === 'pdf') tool = 'imagepdf';
  else throw new Error(`iLovePDF does not support ${inputFormat} → ${outputFormat}`);

  const token = await getToken();
  const { server, task } = await startTask(token, tool);
  const serverFileName = await addFile(token, server, task, fileBuffer, fileName);
  await processTask(token, server, task, serverFileName, { tool, fileName, params: {} });
  return downloadResult(token, server, task);
}

/**
 * Compress PDF using iLovePDF
 */
async function compressPdf(fileBuffer, fileName) {
  const token = await getToken();
  const { server, task } = await startTask(token, 'compress');
  const serverFileName = await addFile(token, server, task, fileBuffer, fileName);
  await processTask(token, server, task, serverFileName, { tool: 'compress', fileName, params: {} });
  return downloadResult(token, server, task);
}

/**
 * Compress image using iLovePDF (imagepdf approach)
 */
async function compressImage(fileBuffer, fileName) {
  // iLovePDF doesn't directly compress images; use a simple resize/quality trick via imagepdf
  // For MVP, return the original - you can integrate Sharp or Jimp here for real compression
  throw new Error('Image compression not supported by iLovePDF directly');
}

module.exports = { convertFile, compressPdf, compressImage };
