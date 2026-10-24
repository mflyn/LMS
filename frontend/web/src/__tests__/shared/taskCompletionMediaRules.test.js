import { MAX_FILE_SIZE, mediaRulesForPurpose, validatePrivateMediaFile } from '../../components/family/privateMediaRules';

test('completion is exactly ten JPEG/PNG/WebP images, each at most 10 MiB', () => {
  expect(mediaRulesForPurpose('task_completion')).toEqual({ maxItems: 10, acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] });
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
    expect(validatePrivateMediaFile({ type, size: MAX_FILE_SIZE }, 'task_completion')).toBeNull();
    expect(validatePrivateMediaFile({ type, size: MAX_FILE_SIZE + 1 }, 'task_completion')).toMatchObject({ code: 'MEDIA_SIZE_EXCEEDED' });
  }
  expect(validatePrivateMediaFile({ type: 'application/pdf', size: 10 }, 'task_completion')).toMatchObject({ code: 'MEDIA_TYPE_NOT_ALLOWED' });
});
test.each(['image/heic', 'image/heif', ''])('HEIC has an actionable conversion hint for %s', type => {
  expect(validatePrivateMediaFile({ type, name: 'IMG.HEIC', size: 20 }, 'task_completion').message).toMatch(/JPEG.*PNG/);
  expect(validatePrivateMediaFile({ type, name: 'IMG.HEIC', size: 20 }, 'task_completion').message).toMatch(/转换|兼容/);
});
test('old materials and mistake PDF support and limits remain unchanged', () => {
  for (const purpose of ['task_attachment', 'mistake_question', 'mistake_answer']) {
    expect(validatePrivateMediaFile({ type: 'application/pdf', size: MAX_FILE_SIZE }, purpose)).toBeNull();
  }
  expect(mediaRulesForPurpose('task_attachment').maxItems).toBe(100);
  expect(mediaRulesForPurpose('mistake_answer').maxItems).toBe(10);
  expect(mediaRulesForPurpose('child_avatar').maxItems).toBe(1);
});
