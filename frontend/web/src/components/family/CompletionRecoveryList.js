import React, { useCallback, useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { LeftOutlined, RightOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { captureSession, isSessionCurrent, subscribeSessionChanges } from '../../services/familySession';
import { listOwnCompletionRecoveries } from '../../services/childApi';
import { listCompletionRecoveries } from '../../services/familyApi';

const ScopedList = ({ session, childId, onOpen }) => {
  const [enabled, setEnabled] = useState(false), [page, setPage] = useState(1);
  const heading = useId();
  const isCurrentRequest = useCallback(() => isSessionCurrent(session), [session]);
  const load = useCallback(async ({ signal }) => {
    const request = session.role === 'student' ? listOwnCompletionRecoveries : listCompletionRecoveries;
    const result = await request({ page, pageSize: 20 }, signal, session);
    if (!Array.isArray(result?.items) || result.page !== page || typeof result.hasMore !== 'boolean'
      || result.items.some(row => !/^[0-9a-f]{24}$/.test(row.taskId) || !/^[0-9a-f]{24}$/.test(row.childId))) {
      throw new Error('Invalid recovery list');
    }
    return result;
  }, [page, session]);
  const resource = useAsyncResource({ load, enabled, isCurrentRequest });
  const items = (resource.data?.items || []).filter(row => row.childId === childId);
  return <section className="task-completion-panel" aria-labelledby={heading}>
    <h2 id={heading}>待恢复提交</h2>
    <button type="button" disabled={resource.state === 'loading'} onClick={() => {
      if (enabled) resource.reload(); else setEnabled(true);
    }}><ReloadOutlined aria-hidden="true" />检查待恢复提交</button>
    {enabled && resource.state === 'loading' && <p role="status">正在检查待恢复提交...</p>}
    {['error', 'retryable_error'].includes(resource.state) && <p role="alert">暂时无法读取待恢复提交，请重试。</p>}
    {resource.data && <>
      {!items.length && <p>本页没有当前孩子的待恢复提交。</p>}
      <ul>{items.map(row => <li key={row.taskId}>
        {session.role === 'student' ? <Link to={`/child/tasks/${row.taskId}`}>查看待恢复提交 {row.taskId}</Link>
          : <button type="button" onClick={() => onOpen(row)}>查看待恢复提交 {row.taskId}</button>}
      </li>)}</ul>
      <div className="task-completion-actions">
        <button type="button" aria-label="待恢复提交上一页" title="上一页" disabled={page === 1}
          onClick={() => setPage(value => value - 1)}><LeftOutlined aria-hidden="true" /></button>
        <span>第 {page} 页</span>
        <button type="button" aria-label="待恢复提交下一页" title="下一页" disabled={!resource.data.hasMore}
          onClick={() => setPage(value => value + 1)}><RightOutlined aria-hidden="true" /></button>
      </div>
    </>}
  </section>;
};

export default function CompletionRecoveryList({ role, childId, onOpen }) {
  const [, changed] = useState(0);
  useEffect(() => subscribeSessionChanges(() => changed(value => value + 1)), []);
  const session = captureSession(role);
  if (!session || !childId || !isSessionCurrent(session)) return null;
  return <ScopedList key={JSON.stringify([session.actorId, session.revision, childId])}
    session={session} childId={childId} onOpen={onOpen} />;
}
