const sharp = require('sharp');
const {
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFString
} = require('pdf-lib');

const PROCESSOR_PATH = '../services/privateMediaProcessor';

const loadProcessor = () => require(PROCESSOR_PATH).createPrivateMediaProcessor;

const makeImage = async (format, options = {}) => {
  let pipeline = sharp({
    create: {
      width: options.width || 8,
      height: options.height || 8,
      channels: 3,
      background: { r: 25, g: 100, b: 180 }
    }
  });
  if (options.metadata) pipeline = pipeline.withMetadata({ orientation: 6 });
  if (format === 'jpeg' && options.quality) pipeline = pipeline.jpeg({ quality: options.quality });
  else pipeline = pipeline.toFormat(format);
  return pipeline.toBuffer();
};

const makePdf = async ({ pages = 1, configure } = {}) => {
  const document = await PDFDocument.create();
  for (let index = 0; index < pages; index += 1) document.addPage([200, 200]);
  if (configure) await configure(document);
  return Buffer.from(await document.save({ addDefaultPage: false, useObjectStreams: false }));
};

const replaceStartXref = (bytes, replacement) => Buffer.from(
  bytes.toString('latin1').replace(/startxref\s+\d+\s+%%EOF\s*$/, `startxref\n${replacement}\n%%EOF`),
  'latin1'
);

const expectCode = async (promise, code, statusCode) => {
  await expect(promise).rejects.toMatchObject({ code, statusCode, isOperational: true });
};

describe('private media canonical processor', () => {
  test.each([
    ['jpeg', 'image/jpeg'],
    ['png', 'image/png'],
    ['webp', 'image/webp']
  ])('TC-MPA-MEDIA-001 detects and canonicalizes %s from bytes', async (format, mimeType) => {
    const processor = loadProcessor()();
    const result = await processor.prepare({
      bytes: await makeImage(format),
      purpose: 'mistake_question',
      originalName: '../misleading.pdf'
    });

    expect(result).toEqual(expect.objectContaining({
      buffer: expect.any(Buffer),
      mimeType,
      displayName: 'misleading.pdf',
      sizeBytes: expect.any(Number)
    }));
    expect(result.pageCount).toBeUndefined();
    expect((await sharp(result.buffer).metadata()).format).toBe(format);
  });

  test.each([1, 50])('TC-MPA-MEDIA-002 accepts and reparses a %i-page PDF', async (pages) => {
    const processor = loadProcessor()();
    const result = await processor.prepare({
      bytes: await makePdf({ pages }),
      purpose: 'mistake_answer',
      originalName: '../answer.bin'
    });

    expect(result.mimeType).toBe('application/pdf');
    expect(result.displayName).toBe('answer.bin');
    expect(result.pageCount).toBe(pages);
    expect(result.buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    await expect(PDFDocument.load(result.buffer, {
      ignoreEncryption: false,
      throwOnInvalidObject: true,
      updateMetadata: false
    })).resolves.toMatchObject({ isEncrypted: false });
  });

  test('TC-MPA-MEDIA-003 rejects empty, over-page, encrypted, and malformed PDFs', async () => {
    const processor = loadProcessor()();
    const empty = await makePdf({ pages: 0 });
    const overPage = await makePdf({ pages: 51 });
    const encrypted = await makePdf({
      configure: async (document) => {
        const encrypt = document.context.obj({
          Filter: 'Standard',
          V: 1,
          R: 2,
          O: PDFHexString.of('00'),
          U: PDFHexString.of('00'),
          P: -4
        });
        document.context.trailerInfo.Encrypt = document.context.register(encrypt);
      }
    });

    await expectCode(processor.prepare({
      bytes: empty,
      purpose: 'mistake_question',
      originalName: 'empty.pdf'
    }), 'PDF_INVALID', 400);
    await expectCode(processor.prepare({
      bytes: overPage,
      purpose: 'mistake_question',
      originalName: 'large.pdf'
    }), 'PDF_PAGE_LIMIT_EXCEEDED', 400);
    await expectCode(processor.prepare({
      bytes: encrypted,
      purpose: 'mistake_question',
      originalName: 'encrypted.pdf'
    }), 'PDF_INVALID', 400);
    await expectCode(processor.prepare({
      bytes: Buffer.from('%PDF-1.7\ninvalid xref'),
      purpose: 'mistake_question',
      originalName: 'malformed.pdf'
    }), 'PDF_INVALID', 400);
  });

  test('TC-MPA-MEDIA-003 rejects object streams before parsing and invalid final xref pointers', async () => {
    const processor = loadProcessor()();
    const objectStreamDocument = await PDFDocument.create();
    objectStreamDocument.addPage([200, 200]);
    const objectStream = Buffer.from(await objectStreamDocument.save({ useObjectStreams: true }));
    const classic = await makePdf();

    await expectCode(processor.prepare({
      bytes: objectStream,
      purpose: 'mistake_question',
      originalName: 'compressed.pdf'
    }), 'PDF_INVALID', 400);
    await expectCode(processor.prepare({
      bytes: replaceStartXref(classic, 1),
      purpose: 'mistake_question',
      originalName: 'wrong-xref.pdf'
    }), 'PDF_INVALID', 400);
    await expectCode(processor.prepare({
      bytes: Buffer.from(classic.toString('latin1').replace(/\nxref\n[\s\S]*?\ntrailer\n/, '\n'), 'latin1'),
      purpose: 'mistake_question',
      originalName: 'missing-xref.pdf'
    }), 'PDF_INVALID', 400);
  });

  test.each([
    ['OpenAction', (document) => document.catalog.set(
      PDFName.of('OpenAction'),
      document.context.obj({ S: 'JavaScript', JS: PDFString.of('app.alert(1)') })
    )],
    ['JavaScript name tree', (document) => document.catalog.set(
      PDFName.of('Names'),
      document.context.obj({ JavaScript: { Names: [] } })
    )],
    ['embedded file', (document) => document.catalog.set(
      PDFName.of('Names'),
      document.context.obj({ EmbeddedFiles: { Names: [] } })
    )],
    ['file attachment annotation', (document) => document.getPage(0).node.set(
      PDFName.of('Annots'),
      document.context.obj([{ Type: 'Annot', Subtype: 'FileAttachment' }])
    )],
    ['XFA', (document) => document.catalog.set(
      PDFName.of('AcroForm'),
      document.context.obj({ XFA: PDFString.of('payload') })
    )],
    ['RichMedia', (document) => document.getPage(0).node.set(
      PDFName.of('Annots'),
      document.context.obj([{ Type: 'Annot', Subtype: 'RichMedia' }])
    )],
    ['launch action', (document) => document.catalog.set(
      PDFName.of('AA'),
      document.context.obj({ WC: { S: 'Launch', F: PDFString.of('file.exe') } })
    )],
    ['external file action', (document) => document.catalog.set(
      PDFName.of('OpenAction'),
      document.context.obj({ S: 'GoToR', F: PDFString.of('remote.pdf') })
    )],
    ['embedded target action', (document) => document.getPage(0).node.set(
      PDFName.of('Annots'),
      document.context.obj([{ Type: 'Annot', Subtype: 'Link', A: { S: 'GoToE' } }])
    )],
    ['rendition action', (document) => document.getPage(0).node.set(
      PDFName.of('Annots'),
      document.context.obj([{ Type: 'Annot', Subtype: 'Screen', A: { S: 'Rendition' } }])
    )],
    ['form submission action', (document) => document.getPage(0).node.set(
      PDFName.of('Annots'),
      document.context.obj([{ Type: 'Annot', Subtype: 'Widget', A: { S: 'SubmitForm' } }])
    )],
    ['form import action', (document) => document.getPage(0).node.set(
      PDFName.of('Annots'),
      document.context.obj([{ Type: 'Annot', Subtype: 'Widget', A: { S: 'ImportData' } }])
    )],
    ['URI action', (document) => document.getPage(0).node.set(
      PDFName.of('Annots'),
      document.context.obj([{ Type: 'Annot', Subtype: 'Link', A: { S: 'URI' } }])
    )],
    ['transition action', (document) => document.getPage(0).node.set(
      PDFName.of('AA'),
      document.context.obj({ O: { S: 'Trans' } })
    )],
    ['three-dimensional annotation', (document) => document.getPage(0).node.set(
      PDFName.of('Annots'),
      document.context.obj([{ Type: 'Annot', Subtype: '3D' }])
    )],
    ['movie annotation', (document) => document.getPage(0).node.set(
      PDFName.of('Annots'),
      document.context.obj([{ Type: 'Annot', Subtype: 'Movie' }])
    )],
    ['sound annotation', (document) => document.getPage(0).node.set(
      PDFName.of('Annots'),
      document.context.obj([{ Type: 'Annot', Subtype: 'Sound' }])
    )]
  ])('TC-MPA-MEDIA-004 rejects %s content', async (_label, configure) => {
    const processor = loadProcessor()();
    const bytes = await makePdf({ configure });

    await expectCode(processor.prepare({
      bytes,
      purpose: 'mistake_question',
      originalName: 'active.pdf'
    }), 'PDF_ACTIVE_CONTENT_REJECTED', 400);
  });

  test('TC-MPA-MEDIA-005 enforces input and canonical output size limits', async () => {
    const boundaryImage = await makeImage('png', { metadata: true });
    await expect(loadProcessor()({ maxBytes: boundaryImage.length }).prepare({
      bytes: boundaryImage,
      purpose: 'mistake_question',
      originalName: 'boundary.png'
    })).resolves.toEqual(expect.objectContaining({ mimeType: 'image/png' }));

    const overLimit = loadProcessor()({ maxBytes: 64 });
    await expectCode(overLimit.prepare({
      bytes: Buffer.alloc(65, 0),
      purpose: 'mistake_question',
      originalName: 'large.bin'
    }), 'MEDIA_TOO_LARGE', 413);

    const lowQualityJpeg = await makeImage('jpeg', { width: 64, height: 64, quality: 1 });
    const postLimit = loadProcessor()({ maxBytes: lowQualityJpeg.length + 32 });
    await expectCode(postLimit.prepare({
      bytes: lowQualityJpeg,
      purpose: 'mistake_question',
      originalName: 'expands.jpg'
    }), 'MEDIA_TOO_LARGE', 413);
  });

  test('TC-MPA-MEDIA-006 removes image metadata and sanitizes the display name', async () => {
    const processor = loadProcessor()();
    const result = await processor.prepare({
      bytes: await makeImage('jpeg', { metadata: true }),
      purpose: 'mistake_question',
      originalName: '../question\u0000\u202e.jpg'
    });
    const metadata = await sharp(result.buffer).metadata();

    expect(result.displayName).toBe('question.jpg');
    expect(metadata.exif).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();
  });

  test.each(['task_attachment', 'mistake_question', 'mistake_answer'])(
    'TC-MPA-MEDIA-008 accepts PDF for %s',
    async (purpose) => {
      const result = await loadProcessor()().prepare({
        bytes: await makePdf(),
        purpose,
        originalName: 'allowed.pdf'
      });
      expect(result.mimeType).toBe('application/pdf');
    }
  );

  test.each(['avatar', 'task_completion', 'growth_evidence'])(
    'TC-MPA-MEDIA-008 rejects PDF for %s',
    async (purpose) => {
      await expectCode(loadProcessor()().prepare({
        bytes: await makePdf(),
        purpose,
        originalName: 'rejected.pdf'
      }), 'MEDIA_TYPE_NOT_ALLOWED', 400);
    }
  );

  test('TC-MPA-MEDIA-001 rejects unsupported bytes before parsing', async () => {
    await expectCode(loadProcessor()().prepare({
      bytes: Buffer.from('not private media'),
      purpose: 'mistake_question',
      originalName: 'unknown.bin'
    }), 'MEDIA_TYPE_NOT_ALLOWED', 400);
  });
});
