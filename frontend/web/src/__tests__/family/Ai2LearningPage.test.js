import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FamilyLearningPage, { ChildLearningPage } from '../../pages/family/Ai2LearningPage';
import { createAi2Api } from '../../services/ai2Api';
import { saveParentSession, saveChildSession, clearChildSession, captureSession } from '../../services/familySession';
import { readAi2Command } from '../../services/ai2Commands';
import { tutorApi } from '../../services/tutorApi';
import { resetChildScope } from '../../services/childScope';

jest.mock('../../services/ai2Api', () => {
  const api = Object.fromEntries(['packages','detail','attempts','attempt','commands','command','preview','publish','withdraw','submit','review','recover'].map(k => [k,jest.fn()]));
  return { createAi2Api: () => api };
});
jest.mock('../../services/tutorApi', () => ({ tutorApi: { detail: jest.fn() } }));
jest.mock('../../components/family/Ai2Media', () => ({ __esModule: true, default: props => <div>
  {!props.readOnly && <button onClick={() => props.onChange(['1'.repeat(24)])} disabled={props.disabled}>合成选图</button>}
  {props.readOnly && <button onClick={() => props.values.forEach(x => props.onViewed?.(x.mediaId))}>合成图片已读</button>}
</div> }));
let mockChild = 'c'.repeat(24);
jest.mock('../../contexts/FamilyContext', () => ({ useFamily: () => ({ family: { familyId: 'b'.repeat(24) }, selectedChildId: mockChild, childScopeVersion: 1 }) }));
jest.mock('../../contexts/ChildAuthContext', () => ({ useChildAuth: () => ({ child: { familyId: 'b'.repeat(24), childId: 'c'.repeat(24) } }) }));
const api = createAi2Api('parent'), familyId = 'b'.repeat(24), childId = 'c'.repeat(24), packageId = 'd'.repeat(24), attemptId = 'e'.repeat(24);
const commandId = 'f'.repeat(24);
const snapshot = { questionText: '合成题目 123 × 24', explanationText: '合成孩子讲解', chapter: { subject: 'math', grade: 4, term: 'upper', textbookLabel: '合成教材', chapterLabel: '乘法' }, source: { type: 'task', id: '9'.repeat(24) } };
const pack = () => ({ id: packageId, childSnapshot: snapshot, visibility: 'published', learningState: 'open', stateVersion: 1,
  currentAttemptId: null, currentAttemptVersion: 0, pending: false, attempts: [], sourceAvailability: 'available' });
const submitted = () => ({ ...pack(), learningState: 'submitted', stateVersion: 3, currentAttemptId: attemptId, currentAttemptVersion: 1,
  attempts: [{ id: attemptId, attemptVersion: 1, attemptPayloadHash: '2'.repeat(64), note: '合成订正', media: [{ mediaId:'1'.repeat(24),mimeType:'image/png',sizeBytes:100,status:'available' }], review:null }] });
const loginChild = () => saveChildSession({token:'synthetic-child', child:{ childId,familyId,name:'合成孩子' }});
const show = (role = 'student', query = `packageId=${packageId}`) => render(<MemoryRouter initialEntries={[`/${role === 'parent' ? 'app' : 'child'}/learning?${query}`]}
  future={{v7_startTransition:true,v7_relativeSplatPath:true}}>{role === 'parent' ? <FamilyLearningPage /> : <ChildLearningPage />}</MemoryRouter>);
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); mockChild = childId;
  saveParentSession({token:'synthetic-parent',user:{id:'a'.repeat(24),role:'parent'}}); loginChild();
  api.packages.mockResolvedValue({items:[pack()]});api.commands.mockResolvedValue({items:[]});api.attempts.mockResolvedValue({items:[]});api.detail.mockResolvedValue({package:pack()});
});
test('unknown submit survives refresh and retries the exact command without another UUID', async () => {
  api.submit.mockRejectedValue(new Error('lost')); const view=show(); await screen.findByText(snapshot.explanationText);
  fireEvent.click(screen.getByText('合成选图'));fireEvent.change(screen.getByLabelText('订正说明'),{target:{value:'第一行\r\n第二行'}});
  fireEvent.click(screen.getByRole('button',{name:'提交订正'}));await screen.findByRole('button',{name:'重试原命令'});
  const original=api.submit.mock.calls[0][1];expect(original.mediaIds).toEqual(['1'.repeat(24)]);
  view.unmount();show();await screen.findByRole('button',{name:'重试原命令'});expect(api.submit).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button',{name:'重试原命令'}));await waitFor(()=>expect(api.submit).toHaveBeenCalledTimes(2));
  expect(api.submit.mock.calls[1][1]).toEqual(original);
});
test.each(['查看学习包', '查看学习包内容'])('successful submit rereads the same URL only after explicit %s', async link => {
  api.submit.mockImplementation((_, body) => Promise.resolve({ command: { id: commandId,
    operationId: body.operationId, endpointOperation: 'ai2.submit', phase: 'SUCCEEDED', resultReference: { packageId, attemptId } } }));
  show('student', `childId=${childId}&packageId=${packageId}`); await screen.findByText(snapshot.explanationText);
  fireEvent.click(screen.getByText('合成选图')); fireEvent.click(screen.getByRole('button', { name: '提交订正' }));
  await screen.findByText('原命令已完成，请重新查看学习包。');
  expect(api.detail).toHaveBeenCalledTimes(2); // Initial read and new-submit permission read; no post-write read.
  expect(screen.queryByRole('region', { name: '学习包详情' })).not.toBeInTheDocument();
  api.detail.mockResolvedValue({ package: submitted() });
  fireEvent.click(screen.getByRole('link', { name: link, exact: true }));
  await screen.findByRole('heading', { name: '等待家长审核', exact: true });
  expect(api.detail).toHaveBeenCalledTimes(3); expect(api.submit).toHaveBeenCalledTimes(1);
  expect(readAi2Command({ familyId, childId }, captureSession('student'))).toBeNull();
});
test('successful parent review same-URL readback does not resubmit or trust an old view', async () => {
  api.detail.mockResolvedValue({ package: submitted() });
  api.review.mockImplementation((_, __, body) => Promise.resolve({ command: { id: commandId,
    operationId: body.operationId, endpointOperation: 'ai2.review', phase: 'SUCCEEDED', resultReference: { packageId, attemptId } } }));
  show('parent', `childId=${childId}&packageId=${packageId}`); await screen.findByText('合成订正');
  fireEvent.click(screen.getByText('合成图片已读')); fireEvent.click(screen.getByRole('button', { name: '通过所见订正' }));
  await screen.findByText('原命令已完成，请重新查看学习包。');
  expect(api.detail).toHaveBeenCalledTimes(1);
  api.detail.mockResolvedValue({ package: { ...submitted(), learningState: 'approved', stateVersion: 4 } });
  fireEvent.click(screen.getByRole('link', { name: '查看学习包', exact: true }));
  await screen.findByRole('heading', { name: '已通过', exact: true });
  expect(api.detail).toHaveBeenCalledTimes(2); expect(api.review).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: '通过所见订正' })).not.toBeInTheDocument();
});
test('logout clears local command; relogin discovers and explicitly recovers original server UUID', async () => {
  api.submit.mockRejectedValue(new Error('lost'));show();await screen.findByText(snapshot.explanationText);
  fireEvent.click(screen.getByText('合成选图'));fireEvent.click(screen.getByRole('button',{name:'提交订正'}));await screen.findByRole('button',{name:'重试原命令'});
  const body=api.submit.mock.calls[0][1];
  act(()=>clearChildSession());expect(screen.queryByText(snapshot.explanationText)).not.toBeInTheDocument();
  api.commands.mockResolvedValue({items:[{id:commandId,operationId:body.operationId,endpointOperation:'ai2.submit',phase:'MEDIA_PREPARED',resultReference:null}]});
  api.recover.mockResolvedValue({command:{id:commandId,operationId:body.operationId,endpointOperation:'ai2.submit',phase:'MEDIA_PREPARED'},pending:true});
  act(()=>loginChild());await screen.findByRole('button',{name:'恢复原提交'});
  expect(readAi2Command({familyId,childId},captureSession('student'))).toBeNull();expect(api.recover).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'恢复原提交'}));await waitFor(()=>expect(api.recover).toHaveBeenCalledTimes(1));
  expect(api.recover.mock.calls[0].slice(0,2)).toEqual([commandId,{schemaVersion:'ai2-min-v1',operationId:body.operationId}]);
  expect(api.submit).toHaveBeenCalledTimes(1);
});
async function unknownSubmissionForRecovery() {
  api.submit.mockRejectedValue(new Error('lost submit response'));
  show(); await screen.findByText(snapshot.explanationText);
  fireEvent.click(screen.getByText('合成选图')); fireEvent.click(screen.getByRole('button', { name: '提交订正' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '重试原命令' })).toBeEnabled());
  const original = readAi2Command({ familyId, childId }, captureSession('student'));
  const command = { id: commandId, operationId: original.body.operationId, endpointOperation: 'ai2.submit', phase: 'MEDIA_PREPARED', resultReference: null };
  api.commands.mockResolvedValue({ items: [command] });
  fireEvent.click(screen.getByRole('button', { name: '刷新学习包记录' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '恢复原提交' })).toBeEnabled());
  return { original, command };
}
test.each([403, 404].flatMap(status => ['detail', 'command'].map(late => [status, late])))(
  'SESSION-02 recover %i clears private views and fences late %s success without losing original intent', async (status, late) => {
    const { original, command } = await unknownSubmissionForRecovery();
    let release;
    const deferred = new Promise(resolve => { release = resolve; });
    try {
      if (late === 'detail') {
        api.detail.mockReturnValueOnce(deferred); fireEvent.click(screen.getByRole('button', { name: '刷新学习包详情' }));
        await waitFor(() => expect(api.detail).toHaveBeenCalledTimes(3));
      } else {
        api.command.mockReturnValueOnce(deferred); fireEvent.click(screen.getByRole('button', { name: '查询原命令结果' }));
        await waitFor(() => expect(api.command).toHaveBeenCalledTimes(1));
      }
      api.recover.mockRejectedValueOnce({ response: { status } });
      fireEvent.click(screen.getByRole('button', { name: '恢复原提交' }));
      await screen.findByText('当前身份无法查看这些私有学习内容。');
      expect(screen.queryByText(snapshot.explanationText)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '提交订正' })).not.toBeInTheDocument();
      const value = late === 'detail' ? { package: submitted() } : { command: { ...command, phase: 'SUCCEEDED',
        payload: original.body, resultReference: { packageId, attemptId } } };
      await act(async () => release(value));
      expect(screen.queryByText(snapshot.explanationText)).not.toBeInTheDocument();
      expect(screen.queryByText('原命令已完成，请重新查看学习包。')).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: '查看学习包', exact: true })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '恢复原提交' })).not.toBeInTheDocument();
      expect(readAi2Command({ familyId, childId }, captureSession('student'))).toEqual(original);
      expect(api.recover.mock.calls[0].slice(0, 2)).toEqual([commandId, { schemaVersion: 'ai2-min-v1', operationId: original.body.operationId }]);
      expect(api.submit).toHaveBeenCalledTimes(1); expect(api.recover).toHaveBeenCalledTimes(1);
    } finally { await act(async () => release({})); }
  });
test.each([403, 404])('SESSION-02 detail %i fences a late successful recover receipt', async status => {
  const { original, command } = await unknownSubmissionForRecovery();
  let release; const deferred = new Promise(resolve => { release = resolve; });
  try {
    api.recover.mockReturnValueOnce(deferred);
    fireEvent.click(screen.getByRole('button', { name: '恢复原提交' }));
    await waitFor(() => expect(api.recover).toHaveBeenCalledTimes(1));
    api.detail.mockRejectedValueOnce({ response: { status } });
    fireEvent.click(screen.getByRole('button', { name: '刷新学习包详情' }));
    await screen.findByText('当前身份无法查看这些私有学习内容。');
    await act(async () => release({ command: { ...command, phase: 'SUCCEEDED', resultReference: { packageId, attemptId } }, pending: false }));
    expect(screen.queryByText(snapshot.explanationText)).not.toBeInTheDocument();
    expect(screen.queryByText('原命令已完成，请重新查看学习包。')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '查看学习包', exact: true })).not.toBeInTheDocument();
    expect(readAi2Command({ familyId, childId }, captureSession('student'))).toEqual(original);
    expect(api.submit).toHaveBeenCalledTimes(1);
  } finally { await act(async () => release({})); }
});
test('SESSION-02 recover network failure keeps original intent, private view and write lock; explicit retry uses original UUID', async () => {
  const { original, command } = await unknownSubmissionForRecovery();
  api.recover.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ command, pending: true });
  fireEvent.click(screen.getByRole('button', { name: '恢复原提交' }));
  await screen.findByRole('alert');
  await waitFor(() => expect(screen.getByRole('button', { name: '恢复原提交' })).toBeEnabled());
  expect(screen.getByText(snapshot.explanationText)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '提交订正' })).toBeDisabled();
  expect(readAi2Command({ familyId, childId }, captureSession('student'))).toEqual(original);
  fireEvent.click(screen.getByRole('button', { name: '恢复原提交' }));
  await screen.findByText('提交仍在处理中，请查询并恢复原提交。');
  expect(api.recover).toHaveBeenCalledTimes(2);
  for (const call of api.recover.mock.calls) expect(call.slice(0, 2)).toEqual([commandId, { schemaVersion: 'ai2-min-v1', operationId: original.body.operationId }]);
  expect(readAi2Command({ familyId, childId }, captureSession('student'))).toEqual(original);
  expect(api.submit).toHaveBeenCalledTimes(1);
});
test.each([403,404])('detail %s clears private content and fences a late write success; network error keeps original command',async status=>{
  let resolve;api.submit.mockImplementation(()=>new Promise(r=>{resolve=r;}));show();await screen.findByText(snapshot.explanationText);
  fireEvent.click(screen.getByText('合成选图'));fireEvent.click(screen.getByRole('button',{name:'提交订正'}));await waitFor(()=>expect(api.submit).toHaveBeenCalledTimes(1));
  const saved=readAi2Command({familyId,childId},captureSession('student'));
  api.detail.mockRejectedValueOnce(new Error('network'));fireEvent.click(screen.getByRole('button',{name:'刷新学习包详情'}));await screen.findByRole('alert');
  expect(screen.getByText(snapshot.explanationText)).toBeInTheDocument();expect(readAi2Command({familyId,childId},captureSession('student'))).toEqual(saved);
  api.detail.mockRejectedValueOnce({response:{status}});fireEvent.click(screen.getByRole('button',{name:'刷新学习包详情'}));
  await waitFor(()=>expect(screen.queryByText(snapshot.explanationText)).not.toBeInTheDocument());
  await act(async()=>resolve({command:{id:commandId,operationId:saved.body.operationId,endpointOperation:'ai2.submit',phase:'SUCCEEDED',resultReference:{packageId,attemptId}},package:submitted()}));
  expect(screen.queryByText(snapshot.explanationText)).not.toBeInTheDocument();expect(readAi2Command({familyId,childId},captureSession('student'))).toEqual(saved);
  expect(screen.queryByText('原命令已完成，请重新查看学习包。')).not.toBeInTheDocument();expect(screen.queryByRole('link',{name:'查看学习包'})).not.toBeInTheDocument();
});
test('parent review uses viewed version and hash, requires images viewed; conflict requires an explicit reread',async()=>{
  api.detail.mockResolvedValue({package:submitted()});api.review.mockRejectedValue({response:{status:409,data:{success:false,error:{code:'AI2_REVIEW_CONFLICT'}}}});
  show('parent');await screen.findByText('合成订正');expect(screen.getByRole('button',{name:'通过所见订正'})).toBeDisabled();
  fireEvent.click(screen.getByText('合成图片已读'));fireEvent.click(screen.getByRole('button',{name:'通过所见订正'}));
  await waitFor(()=>expect(api.review).toHaveBeenCalledTimes(1));expect(api.review.mock.calls[0].slice(0,3)).toEqual([packageId,attemptId,expect.objectContaining({expectedPackageVersion:3,expectedAttemptVersion:1,attemptPayloadHash:'2'.repeat(64),decision:'approve'})]);
  await waitFor(()=>expect(screen.queryByText('合成订正')).not.toBeInTheDocument());expect(api.detail).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button',{name:'刷新学习包详情'}));await screen.findByText('合成订正');expect(screen.getByRole('button',{name:'通过所见订正'})).toBeDisabled();
});
test('published preview shows exact child text and confirms original snapshot only',async()=>{
  const cycleId='8'.repeat(24);tutorApi.detail.mockResolvedValue({cycle:{id:cycleId,childId}});
  const preview={cycleId,expectedCycleStateVersion:4,artifactId:'7'.repeat(24),artifactVersion:2,artifactContentHash:'6'.repeat(64),expectedArtifactReviewVersion:2,childSnapshot:snapshot,childSnapshotHash:'5'.repeat(64)};
  api.preview.mockResolvedValue({preview});api.publish.mockRejectedValue(new Error('lost'));show('parent',`cycleId=${cycleId}`);
  await screen.findByText(snapshot.explanationText);expect(screen.getByRole('button',{name:'发布给孩子'})).toBeDisabled();
  fireEvent.click(screen.getByLabelText('确认以上孩子可见内容'));fireEvent.click(screen.getByRole('button',{name:'发布给孩子'}));
  await waitFor(()=>expect(api.publish).toHaveBeenCalledTimes(1));const {childSnapshot:_childSnapshot,...fields}=preview;
  expect(api.publish.mock.calls[0][0]).toEqual({...fields,schemaVersion:'ai2-min-v1',operationId:expect.any(String),childContentConfirmed:true});
});
test('pending package remains locked when command discovery is empty',async()=>{
  api.detail.mockResolvedValue({package:{...pack(),pending:true}});show();await screen.findByText(snapshot.explanationText);
  expect(screen.getByRole('button',{name:'提交订正'})).toBeDisabled();expect(api.submit).not.toHaveBeenCalled();
});
test('PUB-03 publish conflict discards old preview; only explicit preview and confirmation permit a new command', async () => {
  const cycleId = '8'.repeat(24);
  tutorApi.detail.mockResolvedValue({ cycle: { id: cycleId, childId } });
  const preview = { cycleId, expectedCycleStateVersion: 4, artifactId: '7'.repeat(24), artifactVersion: 2,
    artifactContentHash: '6'.repeat(64), expectedArtifactReviewVersion: 2, childSnapshot: snapshot, childSnapshotHash: '5'.repeat(64) };
  api.preview.mockResolvedValue({ preview });
  api.publish.mockRejectedValueOnce({ response: { status: 409, data: { success: false, error: { code: 'AI2_PUBLICATION_STALE' } } } })
    .mockRejectedValueOnce(new Error('unknown response'));
  show('parent', `cycleId=${cycleId}`); await screen.findByText(snapshot.explanationText);
  fireEvent.click(screen.getByLabelText('确认以上孩子可见内容'));
  fireEvent.click(screen.getByRole('button', { name: '发布给孩子' }));
  await screen.findByText('发布内容已变化，请重新预览。');
  expect(screen.queryByText(snapshot.explanationText)).not.toBeInTheDocument();
  expect(api.publish).toHaveBeenCalledTimes(1); expect(api.preview).toHaveBeenCalledTimes(1);
  expect(readAi2Command({ familyId, childId }, captureSession('parent'))).toBeNull();
  const newer = { ...preview, expectedCycleStateVersion: 5, artifactId: '4'.repeat(24), artifactVersion: 3,
    expectedArtifactReviewVersion: 3, artifactContentHash: '3'.repeat(64), childSnapshotHash: '2'.repeat(64),
    childSnapshot: { ...snapshot, explanationText: '新版家长审核讲解' } };
  api.preview.mockResolvedValue({ preview: newer });
  fireEvent.click(screen.getByRole('button', { name: '重新预览孩子内容' }));
  await screen.findByText(newer.childSnapshot.explanationText);
  expect(screen.getByLabelText('确认以上孩子可见内容')).not.toBeChecked();
  expect(screen.getByRole('button', { name: '发布给孩子' })).toBeDisabled();
  expect(api.publish).toHaveBeenCalledTimes(1); expect(api.preview).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByLabelText('确认以上孩子可见内容'));
  fireEvent.click(screen.getByRole('button', { name: '发布给孩子' }));
  await screen.findByRole('button', { name: '重试原命令' });
  const first = api.publish.mock.calls[0][0], second = api.publish.mock.calls[1][0];
  const { childSnapshot: _snapshot, ...fields } = newer;
  expect(second).toEqual({ ...fields, schemaVersion: 'ai2-min-v1', operationId: expect.any(String), childContentConfirmed: true });
  expect(second.operationId).not.toBe(first.operationId);
  await waitFor(() => expect(screen.getByRole('button', { name: '重试原命令' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '重试原命令' }));
  await waitFor(() => expect(api.publish).toHaveBeenCalledTimes(3));
  expect(api.publish.mock.calls[2][0]).toEqual(second); expect(api.preview).toHaveBeenCalledTimes(2);
});
test.each([
  ['missing', '原来源已不可用，保留发布时内容。'],
  ['unavailable', '来源暂时无法读取，保留发布时内容。']
])('PUB-04 %s source displays its status without replacing the published question or explanation', async (sourceAvailability, text) => {
  api.detail.mockResolvedValue({ package: { ...pack(), sourceAvailability } });
  show();
  expect(await screen.findByText(text)).toBeInTheDocument();
  const detail = within(screen.getByRole('region', { name: '学习包详情' }));
  expect(detail.getByText(snapshot.questionText)).toBeInTheDocument();
  expect(detail.getByText(snapshot.explanationText)).toBeInTheDocument();
  expect(api.preview).not.toHaveBeenCalled(); expect(api.publish).not.toHaveBeenCalled(); expect(api.submit).not.toHaveBeenCalled();
});
test('FAILED acknowledgement clears only the original command and never announces success',async()=>{
  api.submit.mockImplementation((_,body)=>Promise.resolve({command:{id:commandId,operationId:body.operationId,endpointOperation:'ai2.submit',phase:'FAILED',failureCode:'AI2_MEDIA_UNAVAILABLE',resultReference:null},pending:false}));
  show();await screen.findByText(snapshot.explanationText);fireEvent.click(screen.getByText('合成选图'));fireEvent.click(screen.getByRole('button',{name:'提交订正'}));
  await screen.findByText('原提交已确认失败，未发布订正。');expect(screen.queryByText('原命令已完成，请重新查看学习包。')).not.toBeInTheDocument();
  expect(readAi2Command({familyId,childId},captureSession('student'))).toBeNull();
});
test('pending 202 preserves original command and success acknowledgement does not need media detail',async()=>{
  api.submit.mockImplementation((_,body)=>Promise.resolve({command:{id:commandId,operationId:body.operationId,endpointOperation:'ai2.submit',phase:'MEDIA_PREPARED',resultReference:null},pending:true}));
  show();await screen.findByText(snapshot.explanationText);fireEvent.click(screen.getByText('合成选图'));fireEvent.click(screen.getByRole('button',{name:'提交订正'}));
  await screen.findByText('提交仍在处理中，请查询并恢复原提交。');const original=api.submit.mock.calls[0][1];
  api.submit.mockResolvedValue({command:{id:commandId,operationId:original.operationId,endpointOperation:'ai2.submit',phase:'SUCCEEDED',resultReference:{packageId,attemptId}}});
  fireEvent.click(screen.getByRole('button',{name:'重试原命令'}));
  await screen.findByText('原命令已完成，请重新查看学习包。');expect(readAi2Command({familyId,childId},captureSession('student'))).toBeNull();
  api.detail.mockRejectedValue(new Error('media unavailable'));
  fireEvent.click(screen.getByRole('button',{name:'刷新学习包详情'}));await screen.findByRole('alert');
  expect(readAi2Command({familyId,childId},captureSession('student'))).toBeNull();expect(api.submit).toHaveBeenCalledTimes(2);
});
test('mismatched action acknowledgement cannot clear the unknown submit',async()=>{
  api.submit.mockImplementation((_,body)=>Promise.resolve({command:{id:commandId,operationId:body.operationId,endpointOperation:'ai2.withdraw',phase:'SUCCEEDED',resultReference:{packageId,attemptId}}}));
  show();await screen.findByText(snapshot.explanationText);fireEvent.click(screen.getByText('合成选图'));fireEvent.click(screen.getByRole('button',{name:'提交订正'}));
  await screen.findByRole('alert');expect(readAi2Command({familyId,childId},captureSession('student'))).not.toBeNull();
});
test('command terminal GET compares body independent of key order without resending',async()=>{
  api.submit.mockRejectedValue(new Error('lost'));show();await screen.findByText(snapshot.explanationText);
  fireEvent.click(screen.getByText('合成选图'));fireEvent.click(screen.getByRole('button',{name:'提交订正'}));await screen.findByRole('button',{name:'重试原命令'});
  const body=api.submit.mock.calls[0][1];const c={id:commandId,operationId:body.operationId,endpointOperation:'ai2.submit',phase:'SUCCEEDED',resultReference:{packageId,attemptId}};
  let resolveOld;api.detail.mockImplementationOnce(()=>new Promise(r=>{resolveOld=r;}));
  fireEvent.click(screen.getByRole('button',{name:'刷新学习包详情'}));
  api.commands.mockResolvedValue({items:[c]});api.command.mockResolvedValue({command:{...c,payload:Object.fromEntries(Object.entries(body).reverse())}});
  fireEvent.click(screen.getByRole('button',{name:'刷新学习包记录'}));fireEvent.click(await screen.findByRole('button',{name:'查询原命令结果'}));
  await waitFor(()=>expect(readAi2Command({familyId,childId},captureSession('student'))).toBeNull());expect(api.submit).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button',{name:'提交订正'})).not.toBeInTheDocument();
  await act(async()=>resolveOld({package:pack()}));expect(screen.queryByText(snapshot.explanationText)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'刷新学习包详情'}));await screen.findByLabelText('订正说明');
  expect(screen.getByLabelText('订正说明')).toHaveValue('');expect(screen.getByRole('button',{name:'提交订正'})).toBeDisabled();
});
test('parent child switch isolates late preview and rejects another child cycle before preview',async()=>{
  const cycleId='8'.repeat(24);tutorApi.detail.mockResolvedValue({cycle:{id:cycleId,childId:'9'.repeat(24)}});show('parent',`cycleId=${cycleId}`);
  await screen.findByText('当前身份无法查看这些私有学习内容。');expect(api.preview).not.toHaveBeenCalled();
});
test('child change fences a late parent detail without resurrecting private text',async()=>{
  let resolve;api.detail.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));show('parent',`childId=${childId}&packageId=${packageId}`);
  await waitFor(()=>expect(api.detail).toHaveBeenCalledTimes(1));
  act(()=>{mockChild='9'.repeat(24);resetChildScope({previousChildId:childId,nextChildId:mockChild});});
  await act(async()=>resolve({package:submitted()}));expect(screen.getByRole('alert')).toHaveTextContent('该入口不属于当前孩子');
  expect(screen.queryByText(snapshot.explanationText)).not.toBeInTheDocument();
});
test('approved package is readonly while current and historical feedback remains readable',async()=>{
  const p=submitted();p.learningState='approved';p.attempts[0].review={decision:'approve',comment:'合成反馈'};
  api.detail.mockResolvedValue({package:p});api.attempts.mockResolvedValue({items:[{id:attemptId,attemptVersion:1}]});api.attempt.mockResolvedValue({attempt:p.attempts[0]});
  show();await screen.findByText(/合成反馈/);expect(screen.getByRole('button',{name:'提交订正'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'查看订正历史'}));fireEvent.click(await screen.findByRole('button',{name:'查看第 1 次订正'}));
  expect(await screen.findByRole('heading',{name:'历史订正 · 第 1 次'})).toBeInTheDocument();expect(api.submit).not.toHaveBeenCalled();
});
test('current identity superseded read 403 still clears a later pending successful read',async()=>{
  show();await screen.findByText(snapshot.explanationText);let rejectOld,resolveNew;
  api.detail.mockImplementationOnce(()=>new Promise((_,r)=>{rejectOld=r;})).mockImplementationOnce(()=>new Promise(r=>{resolveNew=r;}));
  fireEvent.click(screen.getByRole('button',{name:'刷新学习包详情'}));fireEvent.click(screen.getByRole('button',{name:'刷新学习包详情'}));
  await act(async()=>rejectOld({response:{status:403}}));await act(async()=>resolveNew({package:pack()}));
  expect(screen.queryByText(snapshot.explanationText)).not.toBeInTheDocument();
});
test.each([['focus',403],['pageshow',404],['visibilitychange',404]])('same-session %s refresh rejects %s and fences a late detail',async(event,status)=>{
  show();await screen.findByText(snapshot.explanationText);let rejectOld,resolveNew;
  api.detail.mockImplementationOnce(()=>new Promise((_,r)=>{rejectOld=r;})).mockImplementationOnce(()=>new Promise(r=>{resolveNew=r;}));
  fireEvent(event==='visibilitychange'?document:window,new Event(event));
  await waitFor(()=>expect(api.detail).toHaveBeenCalledTimes(2));
  fireEvent.click(screen.getByRole('button',{name:'刷新学习包详情'}));
  await act(async()=>rejectOld({response:{status}}));await act(async()=>resolveNew({package:pack()}));
  expect(screen.queryByText(snapshot.explanationText)).not.toBeInTheDocument();expect(api.submit).not.toHaveBeenCalled();
});
test('focus network failure retains the original command and never posts automatically',async()=>{
  api.submit.mockRejectedValue(new Error('lost'));show();await screen.findByText(snapshot.explanationText);
  fireEvent.click(screen.getByText('合成选图'));fireEvent.click(screen.getByRole('button',{name:'提交订正'}));await screen.findByRole('button',{name:'重试原命令'});
  const original=readAi2Command({familyId,childId},captureSession('student'));api.detail.mockRejectedValueOnce(new Error('network'));
  fireEvent(window,new Event('focus'));await waitFor(()=>expect(api.detail).toHaveBeenCalledTimes(3));
  expect(readAi2Command({familyId,childId},captureSession('student'))).toEqual(original);expect(api.submit).toHaveBeenCalledTimes(1);
});
test.each(['',`childId=${childId}&`])('parent cannot view a package absent from selected child list (%s)',async prefix=>{
  api.packages.mockResolvedValue({items:[]});show('parent',`${prefix}packageId=${packageId}`);
  await screen.findByText('当前身份无法查看这些私有学习内容。');expect(api.detail).not.toHaveBeenCalled();
  expect(screen.queryByText(snapshot.explanationText)).not.toBeInTheDocument();expect(api.review).not.toHaveBeenCalled();
});
test('bare package URL cannot follow a parent child switch into another child scope',async()=>{
  const view=show('parent');await screen.findByText(snapshot.explanationText);api.packages.mockResolvedValue({items:[]});
  act(()=>{mockChild='9'.repeat(24);resetChildScope({previousChildId:childId,nextChildId:mockChild});});
  view.rerender(<MemoryRouter initialEntries={[`/app/learning?packageId=${packageId}`]} future={{v7_startTransition:true,v7_relativeSplatPath:true}}><FamilyLearningPage /></MemoryRouter>);
  await screen.findByText('当前身份无法查看这些私有学习内容。');expect(api.detail).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(snapshot.explanationText)).not.toBeInTheDocument();
});
test('parent ownership lookup reaches the second page without trusting the URL childId',async()=>{
  api.packages.mockImplementation((_,page)=>Promise.resolve({items:page===1?Array.from({length:20},(_,i)=>({...pack(),id:(i+1).toString(16).padStart(24,'0')})):[pack()]}));
  show('parent');await screen.findByText(snapshot.explanationText);
  expect(api.packages).toHaveBeenCalledWith(childId,2,expect.objectContaining({session:expect.any(Object)}));
});
test('submit rereads permission without upgrading the original version; denied read sends no POST',async()=>{
  show();await screen.findByText(snapshot.explanationText);api.detail.mockRejectedValueOnce({response:{status:404}});
  fireEvent.click(screen.getByText('合成选图'));fireEvent.click(screen.getByRole('button',{name:'提交订正'}));
  await screen.findByText('当前身份无法查看这些私有学习内容。');expect(api.submit).not.toHaveBeenCalled();
  expect(readAi2Command({familyId,childId},captureSession('student')).body.expectedPackageVersion).toBe(1);
});
test('preflight read conflict is not a command acknowledgement and cannot clear its reservation',async()=>{
  show();await screen.findByText(snapshot.explanationText);api.detail.mockRejectedValueOnce({response:{status:409,data:{success:false,error:{code:'AI2_MEDIA_UNAVAILABLE'}}}});
  fireEvent.click(screen.getByText('合成选图'));fireEvent.click(screen.getByRole('button',{name:'提交订正'}));await screen.findByRole('alert');
  const original=readAi2Command({familyId,childId},captureSession('student'));expect(original).not.toBeNull();expect(api.submit).not.toHaveBeenCalled();
  expect(screen.getByRole('button',{name:'重试原命令'})).toBeEnabled();expect(screen.getByRole('button',{name:'提交订正'})).toBeDisabled();
});
test('unknown original retry does not depend on reading withdrawn package content',async()=>{
  api.submit.mockRejectedValueOnce(new Error('lost'));show();await screen.findByText(snapshot.explanationText);
  fireEvent.click(screen.getByText('合成选图'));fireEvent.click(screen.getByRole('button',{name:'提交订正'}));await screen.findByRole('button',{name:'重试原命令'});
  await waitFor(()=>expect(screen.getByRole('button',{name:'重试原命令'})).toBeEnabled());
  const original=api.submit.mock.calls[0][1];api.detail.mockRejectedValue({response:{status:409,data:{success:false,error:{code:'AI2_MEDIA_UNAVAILABLE'}}}});
  api.submit.mockResolvedValue({command:{id:commandId,operationId:original.operationId,endpointOperation:'ai2.submit',phase:'SUCCEEDED',resultReference:{packageId,attemptId}}});
  fireEvent.click(screen.getByRole('button',{name:'重试原命令'}));await screen.findByText('原命令已完成，请重新查看学习包。');
  expect(api.detail).toHaveBeenCalledTimes(2);expect(api.submit.mock.calls[1][1]).toEqual(original);
});
test('withdrawn terminal command without payload retains an explicit original recovery path',async()=>{
  api.submit.mockRejectedValue(new Error('lost'));const view=show();await screen.findByText(snapshot.explanationText);
  fireEvent.click(screen.getByText('合成选图'));fireEvent.click(screen.getByRole('button',{name:'提交订正'}));await screen.findByRole('button',{name:'重试原命令'});
  const original=api.submit.mock.calls[0][1],c={id:commandId,operationId:original.operationId,endpointOperation:'ai2.submit',phase:'SUCCEEDED',resultReference:{packageId,attemptId}};
  view.unmount();api.commands.mockResolvedValue({items:[c]});api.command.mockResolvedValue({command:c});api.recover.mockResolvedValue({command:c,pending:false});api.packages.mockResolvedValue({items:[]});
  show('student','');fireEvent.click(await screen.findByRole('button',{name:'查询原命令结果'}));await screen.findByText('已完成');
  expect(readAi2Command({familyId,childId},captureSession('student')).body).toEqual(original);expect(api.recover).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'恢复原提交'}));await screen.findByText('原命令已完成，请重新查看学习包。');
  expect(api.recover.mock.calls[0].slice(0,2)).toEqual([commandId,{schemaVersion:'ai2-min-v1',operationId:original.operationId}]);
  expect(api.submit).toHaveBeenCalledTimes(1);expect(readAi2Command({familyId,childId},captureSession('student'))).toBeNull();
});
test('successful preflight never adopts a newer version for the saved original write',async()=>{
  api.submit.mockRejectedValue(new Error('lost'));show();await screen.findByText(snapshot.explanationText);api.detail.mockResolvedValue({package:{...pack(),stateVersion:9}});
  fireEvent.click(screen.getByText('合成选图'));fireEvent.click(screen.getByRole('button',{name:'提交订正'}));await screen.findByRole('button',{name:'重试原命令'});
  expect(api.submit.mock.calls[0][1].expectedPackageVersion).toBe(1);
});
