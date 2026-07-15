const net = require('net');

const { AppError } = require('../../../common/middleware/errorTypes');

const DEFAULT_CHUNK_SIZE = 64 * 1024;
const DEFAULT_MAX_RESPONSE_BYTES = 4096;

const malwareDetected = () => new AppError(
  'Malware detected',
  422,
  'MALWARE_DETECTED',
  true,
  []
);
const scannerUnavailable = () => new AppError(
  'Malware scanner unavailable',
  503,
  'MALWARE_SCANNER_UNAVAILABLE',
  true,
  []
);

const assertPositiveInteger = (value, name, max = Number.MAX_SAFE_INTEGER) => {
  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw new Error(`${name} must be an integer between 1 and ${max}`);
  }
};

const createClamAvScanner = ({
  host,
  port,
  connectTimeoutMs,
  scanTimeoutMs,
  chunkSize = DEFAULT_CHUNK_SIZE,
  maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES,
  netModule = net
} = {}) => {
  if (typeof host !== 'string' || !host.trim()) throw new Error('ClamAV host is required');
  assertPositiveInteger(port, 'ClamAV port', 65535);
  assertPositiveInteger(connectTimeoutMs, 'ClamAV connect timeout');
  assertPositiveInteger(scanTimeoutMs, 'ClamAV scan timeout');
  assertPositiveInteger(chunkSize, 'ClamAV chunk size', 1024 * 1024);
  assertPositiveInteger(maxResponseBytes, 'ClamAV response limit', 64 * 1024);

  const execute = ({ command, payload = null, operationTimeoutMs }) => new Promise((resolve, reject) => {
    let settled = false;
    let connectTimer;
    let operationTimer;
    let response = Buffer.alloc(0);
    const socket = netModule.createConnection({ host: host.trim(), port });

    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(connectTimer);
      clearTimeout(operationTimer);
      socket.destroy();
      if (error) reject(error);
      else resolve(value);
    };

    connectTimer = setTimeout(() => finish(scannerUnavailable()), connectTimeoutMs);
    socket.once('connect', () => {
      clearTimeout(connectTimer);
      operationTimer = setTimeout(() => finish(scannerUnavailable()), operationTimeoutMs);
      socket.write(Buffer.from(`${command}\0`, 'ascii'));
      if (payload === null) return;

      for (let offset = 0; offset < payload.length; offset += chunkSize) {
        const chunk = payload.subarray(offset, Math.min(payload.length, offset + chunkSize));
        const header = Buffer.allocUnsafe(4);
        header.writeUInt32BE(chunk.length, 0);
        socket.write(header);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
    });
    socket.on('data', (chunk) => {
      if (settled) return;
      if (response.length + chunk.length > maxResponseBytes) {
        finish(scannerUnavailable());
        return;
      }
      response = Buffer.concat([response, chunk]);
      const terminator = response.indexOf(0);
      if (terminator < 0) return;
      finish(null, response.subarray(0, terminator).toString('utf8').trim());
    });
    socket.once('error', () => finish(scannerUnavailable()));
    socket.once('end', () => {
      if (!settled) finish(scannerUnavailable());
    });
    socket.once('close', () => {
      if (!settled) finish(scannerUnavailable());
    });
  });

  const ping = async () => {
    const response = await execute({ command: 'zPING', operationTimeoutMs: connectTimeoutMs });
    if (response !== 'PONG') throw scannerUnavailable();
  };

  const scan = async (buffer) => {
    if (!Buffer.isBuffer(buffer)) throw new TypeError('scan buffer must be a Buffer');
    const response = await execute({
      command: 'zINSTREAM',
      payload: buffer,
      operationTimeoutMs: scanTimeoutMs
    });
    if (response === 'stream: OK') return;
    if (/^stream: .+ FOUND$/.test(response)) throw malwareDetected();
    throw scannerUnavailable();
  };

  return Object.freeze({ ping, scan });
};

module.exports = {
  DEFAULT_CHUNK_SIZE,
  DEFAULT_MAX_RESPONSE_BYTES,
  createClamAvScanner
};
