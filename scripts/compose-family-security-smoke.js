#!/usr/bin/env node

const { PDFDocument, StandardFonts } = require('pdf-lib');

const trimBaseUrl = (value) => String(value || '').replace(/\/+$/, '');

const smokeError = (code) => Object.assign(new Error(code), { code });

const readJson = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;
  return response.json();
};

const send = async ({ baseUrl, fetchImpl, path, method = 'GET', token, json, body }) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json !== undefined) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers,
      body: json === undefined ? body : JSON.stringify(json),
      signal: AbortSignal.timeout(30000)
    });
  } catch (_error) {
    throw smokeError('SECURITY_SCAN_TRANSPORT_FAILED');
  }
  return { response, envelope: await readJson(response) };
};

const expectData = async (request, expectedStatus, failureCode) => {
  const { response, envelope } = await request;
  if (response.status !== expectedStatus || envelope?.success !== true) {
    throw smokeError(failureCode);
  }
  return envelope.data;
};

const createSafePdf = async () => {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const page = document.addPage([360, 240]);
  page.drawText('Family growth secure scan', { x: 24, y: 180, size: 14, font });
  return Buffer.from(await document.save({ useObjectStreams: false }));
};

const runtimeAntivirusMarker = () => [
  'X5O!P%',
  '@AP[4\\PZ',
  'X54(P^)7',
  'CC)7}$EIC',
  'AR-STANDARD-ANTI',
  'VIRUS-TEST-FILE!',
  '$H+H*'
].join('');

const createRuntimeAntivirusPdf = () => {
  const contents = `q\n% ${runtimeAntivirusMarker()}\nQ\n`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources <<>> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(contents, 'latin1')} >>\nstream\n${contents}endstream`
  ];
  let source = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets[index + 1] = Buffer.byteLength(source, 'latin1');
    source += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(source, 'latin1');
  source += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    source += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  source += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  source += `startxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(source, 'latin1');
};

const uploadPdf = async ({ baseUrl, bytes, childId, fetchImpl, name, purpose, token }) => {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: 'application/pdf' }), name);
  form.append('purpose', purpose);
  form.append('childId', childId);
  return send({
    baseUrl,
    fetchImpl,
    path: '/api/media',
    method: 'POST',
    token,
    body: form
  });
};

const runSecurityScanSmoke = async ({
  baseUrl = process.env.FAMILY_GATEWAY_BASE_URL || 'http://127.0.0.1:3000',
  fetchImpl = global.fetch,
  output = (code) => process.stdout.write(`${code}\n`),
  uniqueSuffix = `${Date.now().toString(36)}${process.pid.toString(36)}`
} = {}) => {
  if (typeof fetchImpl !== 'function' || typeof FormData !== 'function' || typeof Blob !== 'function') {
    throw smokeError('SECURITY_SCAN_RUNTIME_UNSUPPORTED');
  }

  const gatewayUrl = trimBaseUrl(baseUrl);
  const suffix = String(uniqueSuffix).replace(/[^a-zA-Z0-9]/g, '').slice(-16) || 'secure';
  const registration = await expectData(send({
    baseUrl: gatewayUrl,
    fetchImpl,
    path: '/api/auth/register',
    method: 'POST',
    json: {
      username: `sec_${suffix}`.slice(0, 20),
      name: 'Secure Scan Parent',
      email: `secure-${suffix}@example.test`,
      password: 'FamilyPass123',
      role: 'parent'
    }
  }), 201, 'SECURITY_SCAN_SETUP_FAILED');
  if (!registration?.token) throw smokeError('SECURITY_SCAN_SETUP_FAILED');
  const token = registration.token;

  const family = (await expectData(send({
    baseUrl: gatewayUrl,
    fetchImpl,
    path: '/api/families',
    method: 'POST',
    token,
    json: { familyName: `Secure Family ${suffix}`, timezone: 'Asia/Shanghai' }
  }), 201, 'SECURITY_SCAN_SETUP_FAILED'))?.family;
  const child = (await expectData(send({
    baseUrl: gatewayUrl,
    fetchImpl,
    path: '/api/children',
    method: 'POST',
    token,
    json: { name: '安全扫描孩子', grade: 3 }
  }), 201, 'SECURITY_SCAN_SETUP_FAILED'))?.child;
  if (!family?.familyId || !child?.childId) throw smokeError('SECURITY_SCAN_SETUP_FAILED');

  const safeMedia = (await expectData(uploadPdf({
    baseUrl: gatewayUrl,
    bytes: await createSafePdf(),
    childId: child.childId,
    fetchImpl,
    name: 'safe.pdf',
    purpose: 'task_attachment',
    token
  }), 201, 'SECURITY_SCAN_SAFE_PDF_FAILED'))?.media;
  if (!safeMedia?.mediaId) throw smokeError('SECURITY_SCAN_SAFE_PDF_FAILED');

  const task = (await expectData(send({
    baseUrl: gatewayUrl,
    fetchImpl,
    path: '/api/growth-tasks',
    method: 'POST',
    token,
    json: {
      childId: child.childId,
      dimension: 'academic',
      title: '安全扫描 PDF 任务',
      taskType: 'practice',
      dueDate: '2099-12-31',
      attachmentMediaIds: [safeMedia.mediaId]
    }
  }), 201, 'SECURITY_SCAN_SAFE_PDF_FAILED'))?.task;
  if (!task?.taskId || !task.attachmentMediaIds?.includes(safeMedia.mediaId)) {
    throw smokeError('SECURITY_SCAN_SAFE_PDF_FAILED');
  }

  const access = (await expectData(send({
    baseUrl: gatewayUrl,
    fetchImpl,
    path: `/api/media/${safeMedia.mediaId}/access`,
    token
  }), 200, 'SECURITY_SCAN_SAFE_PDF_FAILED'))?.access;
  if (!access?.url) throw smokeError('SECURITY_SCAN_SAFE_PDF_FAILED');

  const contentUrl = new URL(access.url, `${gatewayUrl}/`).toString();
  let content;
  try {
    content = await fetchImpl(contentUrl, { signal: AbortSignal.timeout(30000) });
  } catch (_error) {
    throw smokeError('SECURITY_SCAN_SAFE_PDF_FAILED');
  }
  const contentBytes = Buffer.from(await content.arrayBuffer());
  if (content.status !== 200
    || content.headers.get('content-type') !== 'application/pdf'
    || !String(content.headers.get('content-disposition') || '').startsWith('attachment;')
    || contentBytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw smokeError('SECURITY_SCAN_SAFE_PDF_FAILED');
  }
  output('SECURITY_SCAN_SAFE_PDF_OK');

  const malwareResult = await uploadPdf({
    baseUrl: gatewayUrl,
    bytes: createRuntimeAntivirusPdf(),
    childId: child.childId,
    fetchImpl,
    name: 'runtime-scan-test.pdf',
    purpose: 'mistake_question',
    token
  });
  if (malwareResult.response.status !== 422
    || malwareResult.envelope?.success !== false
    || malwareResult.envelope?.error?.code !== 'MALWARE_DETECTED') {
    throw smokeError('SECURITY_SCAN_MALWARE_ASSERTION_FAILED');
  }
  output('SECURITY_SCAN_MALWARE_REJECTED');

  return { safePdf: 'accepted', malware: 'rejected' };
};

if (require.main === module) {
  runSecurityScanSmoke()
    .then(() => process.stdout.write('SECURITY_SCAN_PASS\n'))
    .catch((error) => {
      const code = typeof error?.code === 'string' ? error.code : 'SECURITY_SCAN_UNEXPECTED_FAILURE';
      process.stderr.write(`SECURITY_SCAN_FAILED:${code}\n`);
      process.exitCode = 1;
    });
}

module.exports = { runSecurityScanSmoke };
