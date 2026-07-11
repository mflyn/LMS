import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FamilyDataState from '../../components/family/FamilyDataState';
import PrivateMediaField from '../../components/family/PrivateMediaField';

describe('Task 9 shared family controls', () => {
  test('renders only supplied unavailable sources for a partial data state', () => {
    render(
      <FamilyDataState
        state="partial"
        unavailableSources={['weekly_report']}
      />
    );

    expect(screen.getByText('部分数据暂不可用')).toBeInTheDocument();
    expect(screen.getByText('weekly_report')).toBeInTheDocument();
    expect(screen.queryByText('reminders')).not.toBeInTheDocument();
  });

  test('exposes a named retry action only for retryable errors', async () => {
    const user = userEvent.setup();
    const onRetry = jest.fn();
    const { rerender } = render(<FamilyDataState state="loading" onRetry={onRetry} />);

    expect(screen.queryByRole('button', { name: '重新加载数据' })).not.toBeInTheDocument();

    rerender(<FamilyDataState state="retryable_error" onRetry={onRetry} />);
    await user.click(screen.getByRole('button', { name: '重新加载数据' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test('rejects files outside the approved private image types and size limit', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const uploadPrivateMedia = jest.fn();
    const onChange = jest.fn();
    render(
      <PrivateMediaField
        label="任务附件"
        childId="child-a1"
        purpose="task_attachment"
        value={null}
        onChange={onChange}
        uploadPrivateMedia={uploadPrivateMedia}
      />
    );

    await user.upload(
      screen.getByLabelText('任务附件'),
      new File(['text'], 'notes.txt', { type: 'text/plain' })
    );
    expect(screen.getByRole('alert')).toHaveTextContent('仅支持 JPEG、PNG 或 WebP 图片');
    expect(uploadPrivateMedia).not.toHaveBeenCalled();

    await user.upload(
      screen.getByLabelText('任务附件'),
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' })
    );
    expect(screen.getByRole('alert')).toHaveTextContent('图片不能超过 10 MiB');
    expect(onChange).not.toHaveBeenCalled();
  });

  test('uploads with child scope, returns only mediaId, and views through an explicit signed-access action', async () => {
    const user = userEvent.setup();
    const uploadPrivateMedia = jest.fn().mockResolvedValue({
      mediaId: 'media-a1',
      accessUrl: 'https://should-not-be-retained.example/upload-response'
    });
    const getPrivateMediaAccess = jest.fn().mockResolvedValue({
      accessUrl: 'https://signed.example/media-a1'
    });
    const onChange = jest.fn();
    const { rerender } = render(
      <PrivateMediaField
        label="任务附件"
        childId="child-a1"
        purpose="task_attachment"
        value={null}
        onChange={onChange}
        uploadPrivateMedia={uploadPrivateMedia}
        getPrivateMediaAccess={getPrivateMediaAccess}
      />
    );

    await user.upload(
      screen.getByLabelText('任务附件'),
      new File(['image'], 'task.png', { type: 'image/png' })
    );

    expect(uploadPrivateMedia).toHaveBeenCalledWith({
      childId: 'child-a1',
      purpose: 'task_attachment',
      file: expect.any(File)
    });
    expect(onChange).toHaveBeenCalledWith('media-a1');
    expect(getPrivateMediaAccess).not.toHaveBeenCalled();
    expect(screen.queryByRole('img', { name: '任务附件预览' })).not.toBeInTheDocument();

    rerender(
      <PrivateMediaField
        label="任务附件"
        childId="child-a1"
        purpose="task_attachment"
        value="media-a1"
        onChange={onChange}
        uploadPrivateMedia={uploadPrivateMedia}
        getPrivateMediaAccess={getPrivateMediaAccess}
      />
    );
    await user.click(screen.getByRole('button', { name: '查看任务附件' }));

    expect(getPrivateMediaAccess).toHaveBeenCalledWith('media-a1');
    expect(screen.getByRole('img', { name: '任务附件预览' })).toHaveAttribute(
      'src',
      'https://signed.example/media-a1'
    );
  });

  test('removes the selected media id through the value callback without deleting the media asset', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <PrivateMediaField
        label="错题图片"
        childId="child-a1"
        purpose="mistake_question"
        value="media-a1"
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole('button', { name: '移除错题图片' }));

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
