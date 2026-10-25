export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export const IMAGE_MIME_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp'
]);

export const PDF_MIME_TYPE = 'application/pdf';

const RULES_BY_PURPOSE = Object.freeze({
  child_avatar: Object.freeze({ acceptedMimeTypes: IMAGE_MIME_TYPES, maxItems: 1 }),
  task_completion: Object.freeze({ acceptedMimeTypes: IMAGE_MIME_TYPES, maxItems: 10 }),
  task_attachment: Object.freeze({
    acceptedMimeTypes: Object.freeze([...IMAGE_MIME_TYPES, PDF_MIME_TYPE]),
    maxItems: 100
  }),
  mistake_question: Object.freeze({
    acceptedMimeTypes: Object.freeze([...IMAGE_MIME_TYPES, PDF_MIME_TYPE]),
    maxItems: 10
  }),
  mistake_answer: Object.freeze({
    acceptedMimeTypes: Object.freeze([...IMAGE_MIME_TYPES, PDF_MIME_TYPE]),
    maxItems: 10
  })
});

const IMAGE_ONLY_RULES = Object.freeze({ acceptedMimeTypes: IMAGE_MIME_TYPES, maxItems: 1 });

export const mediaRulesForPurpose = (purpose) => RULES_BY_PURPOSE[purpose] || IMAGE_ONLY_RULES;

export const validatePrivateMediaFile = (file, purpose) => {
  const rules = mediaRulesForPurpose(purpose);
  if (purpose === 'task_completion' && file
    && (/^image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name || ''))) {
    return { code: 'MEDIA_TYPE_NOT_ALLOWED', message: '请将 HEIC/HEIF 转换为 JPEG 或 PNG 后上传；也可将相机格式设为“兼容性最佳”。' };
  }
  if (!file || !rules.acceptedMimeTypes.includes(file.type)) {
    return {
      code: 'MEDIA_TYPE_NOT_ALLOWED',
      message: rules.acceptedMimeTypes.includes(PDF_MIME_TYPE)
        ? '仅支持 JPEG、PNG、WebP 图片或 PDF'
        : '仅支持 JPEG、PNG 或 WebP 图片'
    };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { code: 'MEDIA_SIZE_EXCEEDED', message: '文件不能超过 10 MiB' };
  }
  return null;
};
export const mediaIdOf = (value) => (typeof value === 'string' ? value : value?.mediaId);
export const isPdfMedia = (value) => value?.mimeType === PDF_MIME_TYPE;

export const formatMediaSize = (sizeBytes) => {
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) return '';
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${Math.ceil(sizeBytes / 1024)} KiB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MiB`;
};
