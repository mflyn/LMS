import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PrivateMediaCollectionField from '../../components/family/PrivateMediaCollectionField';
import {
  MAX_FILE_SIZE,
  mediaRulesForPurpose,
  validatePrivateMediaFile
} from '../../components/family/privateMediaRules';

const image = (name = 'question.png') => new File(['image'], name, { type: 'image/png' });
const pdf = (name = 'answer.pdf') => new File(['pdf'], name, { type: 'application/pdf' });

describe('Task 6 shared private media rules', () => {
  test('TC-MPA-WEB-001 applies purpose MIME, size, and collection limits', () => {
    expect(mediaRulesForPurpose('mistake_question')).toEqual(expect.objectContaining({
      maxItems: 10,
      acceptedMimeTypes: expect.arrayContaining(['image/png', 'application/pdf'])
    }));
    expect(mediaRulesForPurpose('task_attachment').maxItems).toBe(100);
    expect(mediaRulesForPurpose('child_avatar').acceptedMimeTypes).not.toContain('application/pdf');
    expect(validatePrivateMediaFile(pdf(), 'mistake_answer')).toBeNull();
    expect(validatePrivateMediaFile(pdf(), 'child_avatar')).toMatchObject({ code: 'MEDIA_TYPE_NOT_ALLOWED' });
    expect(validatePrivateMediaFile(
      new File([new Uint8Array(MAX_FILE_SIZE + 1)], 'large.pdf', { type: 'application/pdf' }),
      'mistake_question'
    )).toMatchObject({ code: 'MEDIA_SIZE_EXCEEDED' });
  });
});
describe('Task 6 shared private media collection', () => {
  test('TC-MPA-WEB-002 preserves prior uploads and stops a batch at the failed filename', async () => {
    const user = userEvent.setup();
    const uploadPrivateMedia = jest.fn()
      .mockResolvedValueOnce({ media: { mediaId: 'media-a', displayName: 'first.png', mimeType: 'image/png' } })
      .mockRejectedValueOnce({ response: { data: { error: { message: '文件内容不安全' } } } })
      .mockResolvedValueOnce({ media: { mediaId: 'media-c', displayName: 'third.pdf', mimeType: 'application/pdf' } });
    const onChange = jest.fn();

    render(
      <PrivateMediaCollectionField
        label="题目附件"
        childId="child-a1"
        purpose="mistake_question"
        values={[]}
        onChange={onChange}
        uploadPrivateMedia={uploadPrivateMedia}
      />
    );

    await user.upload(screen.getByLabelText('题目附件'), [
      image('first.png'),
      pdf('second.pdf'),
      pdf('third.pdf')
    ]);

    await waitFor(() => expect(uploadPrivateMedia).toHaveBeenCalledTimes(2));
    expect(onChange).toHaveBeenCalledWith(['media-a']);
    expect(screen.getByRole('alert')).toHaveTextContent('second.pdf');
    expect(screen.getByRole('alert')).toHaveTextContent('文件内容不安全');
  });

  test('TC-MPA-WEB-001 enforces the mistake count without changing owner state', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const values = Array.from({ length: 10 }, (_, index) => `media-${index}`);
    const { container } = render(
      <PrivateMediaCollectionField
        label="答案附件"
        childId="child-a1"
        purpose="mistake_answer"
        values={values}
        onChange={onChange}
      />
    );

    expect(screen.getByText('已添加 10/10')).toBeInTheDocument();
    expect(container.querySelector('input[type="file"]')).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '移除答案附件 10' }));
    expect(onChange).toHaveBeenCalledWith(values.slice(0, 9));
  });

  test('TC-MPA-WEB-007 renders image preview and PDF metadata/download without an iframe', async () => {
    const user = userEvent.setup();
    const getPrivateMediaAccess = jest.fn()
      .mockResolvedValueOnce({
        access: { url: 'https://signed.example/image' },
        media: { mediaId: 'image-a', mimeType: 'image/png', displayName: '题目.png', sizeBytes: 1024 }
      })
      .mockResolvedValueOnce({
        access: { url: 'https://signed.example/pdf' },
        media: {
          mediaId: 'pdf-a',
          mimeType: 'application/pdf',
          displayName: '期中试卷.pdf',
          sizeBytes: 245120,
          pageCount: 2
        }
      });
    const { container } = render(
      <PrivateMediaCollectionField
        label="题目附件"
        childId="child-a1"
        purpose="mistake_question"
        values={[
          { mediaId: 'image-a', mimeType: 'image/png', displayName: '题目.png', sizeBytes: 1024 },
          { mediaId: 'pdf-a', mimeType: 'application/pdf', displayName: '期中试卷.pdf', sizeBytes: 245120, pageCount: 2 }
        ]}
        onChange={jest.fn()}
        getPrivateMediaAccess={getPrivateMediaAccess}
      />
    );

    expect(screen.getByText('期中试卷.pdf')).toBeInTheDocument();
    expect(screen.getByText(/2 页/)).toBeInTheDocument();
    expect(container.querySelector('iframe')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '预览题目附件 1' }));
    expect(await screen.findByRole('img', { name: '题目.png 预览' })).toHaveAttribute(
      'src',
      'https://signed.example/image'
    );

    await user.click(screen.getByRole('button', { name: '下载题目附件 2' }));
    expect(await screen.findByRole('link', { name: '保存期中试卷.pdf' })).toHaveAttribute(
      'href',
      'https://signed.example/pdf'
    );
    expect(container.querySelector('iframe')).not.toBeInTheDocument();
  });
});
