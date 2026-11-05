import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LeftOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons';
import { useFamily } from '../../contexts/FamilyContext';
import { useChildAuth } from '../../contexts/ChildAuthContext';
import { captureSession, isSessionCurrent, subscribeSessionChanges } from '../../services/familySession';
import { registerChildScopeReset } from '../../services/childScope';
import { createAi2Api } from '../../services/ai2Api';
import { readAi2Command, saveAi2Command, finishAi2Command, newAi2OperationId } from '../../services/ai2Commands';
import { tutorApi } from '../../services/tutorApi';
import Ai2Media from '../../components/family/Ai2Media';
import './Ai2LearningPage.css';

const id = value => typeof value === 'string' && /^[a-f0-9]{24}$/.test(value);
const version = value => Number.isSafeInteger(value) && value >= 1;
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const normalize = value => value.replace(/\r\n/g, '\n');
const phases = ['RESERVED','MEDIA_PREPARED','MEDIA_COMMITTED','RESOLVING','SUCCEEDED','FAILED'];
const terminal = value => ['SUCCEEDED','FAILED'].includes(value);
const labels = { open:'待订正',revise:'请再订正',submitted:'等待家长审核',approved:'已通过',withdrawn:'已撤回',
  RESERVED:'已接收',MEDIA_PREPARED:'图片处理中',MEDIA_COMMITTED:'正在保存',RESOLVING:'正在收尾',SUCCEEDED:'已完成',FAILED:'未提交成功' };
const code = error => error?.response?.data?.error?.code;
const denied = error => [401,403,404].includes(error?.response?.status);
const message = error => ({ AI2_DISABLED:'本项功能尚未启用。',AI2_PUBLICATION_STALE:'发布内容已变化，请重新预览。',
  AI2_REVIEW_CONFLICT:'订正或审核已变化，请重新查看详情后决定。',AI2_STATE_CONFLICT:'学习包状态已变化，请重新查看。',
  AI2_PACKAGE_ALREADY_PUBLISHED:'该讲解已经发布，请核对学习包列表。',AI2_MEDIA_UNAVAILABLE:'图片不可用，请核对后再处理。',
  IDEMPOTENCY_CONFLICT:'原命令与保存记录不一致，不能换编号重试。',AI2_COMMAND_PENDING:'已有待处理提交，请查询原命令。' }[code(error)] || '结果尚未确认，请保留原命令并重试读取。');
const definitive = error => error?.response?.data?.success === false && typeof code(error) === 'string'
  && (([400,413].includes(error.response.status) && ['VALIDATION_ERROR','AI2_INPUT_TOO_LARGE'].includes(code(error)))
    || (error.response.status === 409 && ['AI2_PUBLICATION_STALE','AI2_PACKAGE_ALREADY_PUBLISHED','AI2_STATE_CONFLICT','AI2_REVIEW_CONFLICT','AI2_MEDIA_UNAVAILABLE','AI2_PACKAGE_WITHDRAWN'].includes(code(error))));
const validPackage = p => p && id(p.id) && version(p.stateVersion) && ['published','withdrawn'].includes(p.visibility)
  && ['open','revise','submitted','approved'].includes(p.learningState) && typeof p.pending === 'boolean'
  && typeof p.childSnapshot?.questionText === 'string' && typeof p.childSnapshot?.explanationText === 'string';
const validCommand = c => c && id(c.id) && typeof c.operationId === 'string' && phases.includes(c.phase)
  && ['ai2.publish','ai2.withdraw','ai2.submit','ai2.review'].includes(c.endpointOperation);
const invalid = () => Object.assign(new Error('Invalid AI2 response'),{code:'AI2_RESPONSE_INVALID'});
const samePayload = (a,b) => a && b && Object.keys(a).length===Object.keys(b).length
  && Object.keys(b).every(key=>Object.prototype.hasOwnProperty.call(a,key)
    && (typeof b[key]==='string'?a[key]===normalize(b[key]):JSON.stringify(a[key])===JSON.stringify(b[key])));
const IconButton = ({label,children,...props}) => <button type="button" className="family-button secondary" title={label} aria-label={label} {...props}>{children}</button>;
const Snapshot = ({value}) => <div className="ai2-snapshot">
  <p>{value.chapter?.textbookLabel} · {value.chapter?.chapterLabel}</p>
  <h3>题目</h3><p className="ai2-text">{value.questionText}</p>
  <h3>讲解</h3><p className="ai2-text">{value.explanationText}</p>
</div>;

export function Ai2Workspace({scope,session,packageId,cycleId,currentScope}) {
  const role=session.role, parent=role==='parent', api=useMemo(()=>createAi2Api(role),[role]);
  const base=parent?'/app/learning':'/child/learning';
  const [packages,setPackages]=useState([]),[commands,setCommands]=useState([]),[detail,setDetail]=useState(null),[preview,setPreview]=useState(null);
  const [history,setHistory]=useState([]),[oldAttempt,setOldAttempt]=useState(null),[pages,setPages]=useState({packages:1,commands:1,history:1});
  const [loading,setLoading]=useState({}),[busy,setBusy]=useState(false),[blocked,setBlocked]=useState(false),[discovered,setDiscovered]=useState(false);
  const [pending,setPending]=useState(()=>{try{return readAi2Command(scope,session);}catch{return {corrupt:true};}});
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[resultPackage,setResultPackage]=useState(null);
  const [note,setNote]=useState(''),[mediaIds,setMediaIds]=useState([]),[comment,setComment]=useState(''),[reason,setReason]=useState(''),[consent,setConsent]=useState(false);
  const [mediaBusy,setMediaBusy]=useState(false),[mediaBlocked,setMediaBlocked]=useState(false),[viewed,setViewed]=useState([]),[mediaEpoch,setMediaEpoch]=useState(0);
  const state=useRef({live:true,epoch:0,requests:{},writing:false});
  const current=g=>state.current.live && g===state.current.epoch && isSessionCurrent(session) && currentScope();
  const cancelReads=()=>{Object.values(state.current.requests).forEach(c=>c.abort());state.current.requests={};};
  useLayoutEffect(()=>{const s=state.current;s.live=true;return()=>{s.live=false;s.epoch++;Object.values(s.requests).forEach(c=>c.abort());};},[]);
  const clearDetails=()=>{setDetail(null);setPreview(null);setHistory([]);setOldAttempt(null);setViewed([]);setConsent(false);setComment('');setReason('');setMediaEpoch(v=>v+1);};
  const deny=()=>{
    state.current.epoch++;cancelReads();state.current.writing=false;setBusy(false);setLoading({});setBlocked(true);setDiscovered(false);
    clearDetails();setPackages([]);setCommands([]);setPending(null);setNote('');setMediaIds([]);setNotice('');setResultPackage(null);
    setMediaBusy(false);setMediaBlocked(false);setError('当前身份无法查看这些私有学习内容。');
  };
  const ownsPackage=async(options,g)=>{
    // Package DTOs omit childId: verify membership using the child-scoped list, including older pages.
    for(let page=1;current(g)&&!options.signal.aborted;page++){
      const data=await api.packages(scope.childId,page,options);
      if(!current(g)||options.signal.aborted)return false;
      if(!Array.isArray(data?.items)||data.items.some(p=>!validPackage(p)))throw invalid();
      if(data.items.some(p=>p.id===packageId))return true;
      if(data.items.length<20){deny();return false;}
    }
    return false;
  };
  const refresh=async(kind,page=1,targetId)=>{
    const g=state.current.epoch;
    if(!current(g)||((kind==='detail'||kind==='history'||kind==='attempt')&&!id(packageId))||(kind==='preview'&&(!parent||!id(cycleId))))return;
    state.current.requests[kind]?.abort();const controller=new AbortController();state.current.requests[kind]=controller;
    setLoading(v=>({...v,[kind]:true}));
    try{
      const options={session,signal:controller.signal};let data;
      if(kind==='preview'){
        const source=await tutorApi.detail(cycleId,options);
        if(!current(g))return;
        if(source?.cycle?.id!==cycleId||source.cycle.childId!==scope.childId){deny();return;}
        data=await api.preview(cycleId,options);
      }else if(kind==='detail'){
        if(parent&&!await ownsPackage(options,g))return;
        data=await api.detail(packageId,options);
      }
      else if(kind==='history')data=await api.attempts(packageId,page,options);
      else if(kind==='attempt')data=await api.attempt(packageId,targetId,options);
      else data=await api[kind](scope.childId,page,options);
      if(!current(g)||state.current.requests[kind]!==controller)return;
      if(kind==='detail'){
        if(!validPackage(data?.package)||data.package.id!==packageId||!Array.isArray(data.package.attempts))throw invalid();
        setDetail(data.package);setViewed([]);setComment('');setReason('');setOldAttempt(null);setMediaEpoch(v=>v+1);
      }else if(kind==='preview'){
        const p=data?.preview;
        if(p?.cycleId!==cycleId||!id(p.artifactId)||!version(p.artifactVersion)||!version(p.expectedArtifactReviewVersion)
          ||!version(p.expectedCycleStateVersion)||!hash(p.artifactContentHash)||!hash(p.childSnapshotHash)
          ||typeof p.childSnapshot?.questionText!=='string'||typeof p.childSnapshot?.explanationText!=='string')throw invalid();
        setPreview(p);setConsent(false);
      }else if(kind==='attempt'){
        if(data?.attempt?.id!==targetId||!Array.isArray(data.attempt.media))throw invalid();setOldAttempt(data.attempt);
      }else{
        if(!Array.isArray(data?.items))throw invalid();
        if(kind==='packages'){if(data.items.some(p=>!validPackage(p)))throw invalid();setPackages(data.items);}
        if(kind==='commands'){if(data.items.some(c=>!validCommand(c)))throw invalid();setCommands(data.items);setDiscovered(true);}
        if(kind==='history')setHistory(data.items);
        setPages(v=>({...v,[kind]:page}));
      }
      setError('');
    }catch(cause){
      if(!current(g))return;
      // Current-identity denials invalidate even superseded reads before request-order filtering.
      if(denied(cause)){deny();return;}
      if(state.current.requests[kind]===controller&&cause.code!=='ERR_CANCELED')setError(message(cause));
    }finally{if(current(g)&&state.current.requests[kind]===controller)setLoading(v=>({...v,[kind]:false}));}
  };
  const latest=useRef(refresh);latest.current=refresh;
  useEffect(()=>{latest.current('packages');latest.current('commands');if(id(packageId))latest.current('detail');if(parent&&id(cycleId))latest.current('preview');},[packageId,cycleId,parent]);
  const foreground=useRef(null);foreground.current=()=>{
    if(blocked||document.visibilityState==='hidden')return;
    latest.current('packages');latest.current('commands');
    if(id(packageId))latest.current('detail');if(parent&&id(cycleId))latest.current('preview');
  };
  useEffect(()=>{
    const refreshVisible=()=>foreground.current();
    window.addEventListener('focus',refreshVisible);window.addEventListener('pageshow',refreshVisible);document.addEventListener('visibilitychange',refreshVisible);
    return()=>{window.removeEventListener('focus',refreshVisible);window.removeEventListener('pageshow',refreshVisible);document.removeEventListener('visibilitychange',refreshVisible);};
  },[]);
  const unresolved=commands.some(c=>!terminal(c.phase));
  const locked=blocked||busy||Boolean(pending)||unresolved||!discovered;
  const acceptResult=(data,original,expectedCommandId)=>{
    const c=data?.command;
    if(!id(c?.id)||c.operationId!==original.body.operationId||c.endpointOperation!==`ai2.${original.action}`||!phases.includes(c.phase)
      ||(expectedCommandId&&c.id!==expectedCommandId))throw invalid();
    if(!terminal(c.phase)){
      if(original.action!=='submit'||data.pending!==true)throw invalid();
      setNotice('提交仍在处理中，请查询并恢复原提交。');return;
    }
    if(c.phase==='SUCCEEDED'&&(!id(c.resultReference?.packageId)
      ||(original.targetId&&c.resultReference.packageId!==original.targetId)
      ||(['submit','review'].includes(original.action)&&!id(c.resultReference?.attemptId))
      ||(original.action==='review'&&c.resultReference.attemptId!==original.attemptId)))throw invalid();
    if(c.phase==='FAILED'&&(original.action!=='submit'||data.pending!==false||typeof c.failureCode!=='string'||c.resultReference!==null))throw invalid();
    finishAi2Command(scope,original.body.operationId,session);setPending(readAi2Command(scope,session));
    state.current.epoch++;cancelReads();state.current.writing=false;setBusy(false);setLoading({});clearDetails();
    setNote('');setMediaIds([]);setMediaBusy(false);setMediaBlocked(false);
    setNotice(c.phase==='FAILED'?'原提交已确认失败，未发布订正。':'原命令已完成，请重新查看学习包。');
    setResultPackage(c.phase==='SUCCEEDED'?c.resultReference.packageId:null);
    latest.current('commands',pages.commands);latest.current('packages',pages.packages);
  };
  const execute=async saved=>{
    const g=state.current.epoch;if(!current(g)||blocked||state.current.writing||saved?.corrupt)return;
    let original,previous,dispatched=false;
    try{previous=readAi2Command(scope,session);original=saveAi2Command(scope,saved,session);}catch{setError('原命令暂存不可用，尚未发送。');return;}
    setPending(original);state.current.writing=true;setBusy(true);setError('');setNotice('');
    const controller=new AbortController();state.current.requests.write=controller;
    try{
      const options={session,signal:controller.signal};
      // Only new intents depend on readable content; original replay may return a redacted terminal receipt.
      if(original.action==='submit'&&!previous){
        const fresh=await api.detail(original.targetId,options);
        if(!current(g))return;
        if(!validPackage(fresh?.package)||fresh.package.id!==original.targetId)throw invalid();
      }
      dispatched=true;
      const data=original.action==='publish'?await api.publish(original.body,options):original.action==='review'
        ?await api.review(original.targetId,original.attemptId,original.body,options):await api[original.action](original.targetId,original.body,options);
      if(!current(g))return;acceptResult(data,original);
    }catch(cause){
      if(!current(g))return;if(denied(cause)){deny();return;}
      if(dispatched&&definitive(cause)){
        finishAi2Command(scope,original.body.operationId,session);setPending(null);
        // A conflict never upgrades the version or silently replays a new command.
        if(cause.response.status===409){state.current.epoch++;cancelReads();clearDetails();state.current.writing=false;setBusy(false);setLoading({});}
      }
      setError(message(cause));
    }finally{if(current(g)){state.current.writing=false;setBusy(false);}}
  };
  const mutate=(action,body,attemptId=null)=>{
    if(locked||state.current.writing||!current(state.current.epoch))return;
    execute({action,targetId:action==='publish'?null:packageId,attemptId,
      body:{schemaVersion:'ai2-min-v1',operationId:newAi2OperationId(),...body}});
  };
  const recover=async item=>{
    const g=state.current.epoch;if(!current(g)||blocked||state.current.writing||item.endpointOperation!=='ai2.submit')return;
    state.current.writing=true;setBusy(true);setError('');
    try{
      const data=await api.recover(item.id,{schemaVersion:'ai2-min-v1',operationId:item.operationId},{session});
      if(!current(g))return;
      const local=readAi2Command(scope,session);
      const original=local&&!local.corrupt&&local.body.operationId===item.operationId?local:{action:'submit',targetId:null,body:{operationId:item.operationId}};
      acceptResult(data,original,item.id);
    }catch(cause){if(current(g)){if(denied(cause))deny();else setError(message(cause));}}
    finally{if(current(g)){state.current.writing=false;setBusy(false);}}
  };
  const inspectCommand=async item=>{
    const g=state.current.epoch;if(!current(g)||blocked||busy)return;
    try{
      const data=await api.command(item.id,{session});if(!current(g))return;
      const c=data?.command;if(!validCommand(c)||c.id!==item.id||c.operationId!==item.operationId)throw invalid();
      const local=readAi2Command(scope,session);
      if(terminal(c.phase)&&local&&!local.corrupt&&local.body.operationId===c.operationId&&c.endpointOperation===`ai2.${local.action}`
        &&samePayload(c.payload,local.body)){
        acceptResult({command:c,pending:false},local,item.id);return;
      }
      setNotice(`${labels[c.phase]}${c.payload?.note?`：${c.payload.note}`:''}`);
      if(terminal(c.phase)&&id(c.resultReference?.packageId))setResultPackage(c.resultReference.packageId);
      latest.current('commands',pages.commands);
    }catch(cause){if(current(g)){if(denied(cause))deny();else setError(message(cause));}}
  };
  const attempt=detail?.attempts?.find(a=>a.id===detail.currentAttemptId);
  const canReview=parent&&detail?.visibility==='published'&&detail.learningState==='submitted'&&!detail.pending&&attempt&&!attempt.review
    &&attempt.attemptVersion===detail.currentAttemptVersion&&hash(attempt.attemptPayloadHash);
  const canSubmit=!parent&&detail?.visibility==='published'&&['open','revise'].includes(detail.learningState)&&!detail.pending;
  const allViewed=attempt?.media?.length>=1&&attempt.media.every(m=>m.status==='available'&&viewed.includes(m.mediaId));
  const review=decision=>mutate('review',{expectedPackageVersion:detail.stateVersion,expectedAttemptVersion:attempt.attemptVersion,
    attemptPayloadHash:attempt.attemptPayloadHash,decision,comment:normalize(comment)},attempt.id);
  const pager=(kind,items)=><nav className="family-inline-actions" aria-label={`${kind}分页`}>
    <IconButton label={`${kind}上一页`} disabled={pages[kind]<=1||loading[kind]} onClick={()=>refresh(kind,pages[kind]-1)}><LeftOutlined /></IconButton>
    <span>第 {pages[kind]} 页</span><IconButton label={`${kind}下一页`} disabled={items.length<20||loading[kind]} onClick={()=>refresh(kind,pages[kind]+1)}><RightOutlined /></IconButton></nav>;
  // Detail refresh invalidates viewed works, not the child's unfinished upload queue.
  const mediaProps={role,session,childId:scope.childId,scopeKey:`${session.revision}:${scope.childId}:${packageId}`,
    onDenied:()=>{if(current(state.current.epoch))deny();}};
  const showAttempt=(a,historical=false)=><article className="ai2-attempt" key={`${historical}:${a.id}`}>
    <h3>{historical?'历史订正':'当前订正'} · 第 {a.attemptVersion} 次</h3><p className="ai2-text">{a.note}</p>
    <Ai2Media {...mediaProps} scopeKey={`${mediaProps.scopeKey}:view:${mediaEpoch}`} key={`${a.id}:${mediaEpoch}`} values={a.media||[]} readOnly
      onViewed={(mediaId,isViewed=true)=>{if(!historical)setViewed(v=>isViewed?(v.includes(mediaId)?v:[...v,mediaId]):v.filter(value=>value!==mediaId));}}
      onDeleted={mediaId=>{setViewed(v=>v.filter(value=>value!==mediaId));
        const mark=x=>({...x,media:x.media.map(m=>m.mediaId===mediaId?{...m,status:'deleted'}:m)});
        setDetail(p=>p?{...p,attempts:p.attempts.map(mark)}:p);setOldAttempt(x=>x?mark(x):x);}} />
    {a.review&&<p className="ai2-text">家长反馈：{a.review.decision==='approve'?'通过':'请再订正'} {a.review.comment}</p>}
    {parent&&a.submittedBy&&<p>提交者：{a.submittedBy}</p>}
    {parent&&a.review?.reviewerId&&<p>审核者：{a.review.reviewerId}</p>}
  </article>;
  return <section className="family-page ai2-page" aria-labelledby="ai2-title">
    <div className="family-page-heading"><h1 id="ai2-title">{parent?'学习包与订正审核':'我的学习包'}</h1>
      <IconButton label="刷新学习包记录" disabled={blocked} onClick={()=>{refresh('packages',pages.packages);refresh('commands',pages.commands);}}><ReloadOutlined /></IconButton></div>
    {id(packageId)&&<IconButton label="刷新学习包详情" disabled={blocked} onClick={()=>refresh('detail')}><ReloadOutlined />重新查看详情</IconButton>}
    {parent&&id(cycleId)&&<IconButton label="重新预览孩子内容" disabled={blocked} onClick={()=>refresh('preview')}><ReloadOutlined />重新预览</IconButton>}
    {error&&<p role="alert" className="family-form-error">{error}</p>}{notice&&<p role="status" className="ai2-text">{notice}</p>}
    {!blocked&&<Link to={`${parent?'/app':'/child'}/practice?childId=${scope.childId}`}>查看变式练习</Link>}
    {!blocked&&resultPackage&&<Link to={`${base}?childId=${scope.childId}&packageId=${resultPackage}`}
      onClick={()=>{if(resultPackage===packageId)refresh('detail');}}>查看学习包</Link>}
    {!blocked&&pending&&<section aria-label="未确认原命令"><p>{pending.corrupt?'本地命令损坏，不能再次发送，请查询原提交记录或退出重登。':'原命令尚未确认，新操作已暂停。'}</p>
      {!pending.corrupt&&<button type="button" className="family-button secondary" disabled={busy} onClick={()=>execute(pending)}>重试原命令</button>}</section>}
    {!blocked&&preview&&parent&&<section aria-label="孩子可见预览"><h2>孩子可见内容</h2><Snapshot value={preview.childSnapshot} />
      <label><input type="checkbox" checked={consent} disabled={locked} onChange={e=>setConsent(e.target.checked)} />确认以上孩子可见内容</label>
      <button type="button" className="family-button primary" disabled={locked||!consent} onClick={()=>{
        const {childSnapshot:_childSnapshot,...fields}=preview;mutate('publish',{...fields,childContentConfirmed:true});
      }}>发布给孩子</button></section>}
    {!blocked&&detail&&<section aria-label="学习包详情"><h2>{detail.visibility==='withdrawn'?'已撤回':labels[detail.learningState]}</h2>
      <Snapshot value={detail.childSnapshot} />{detail.sourceAvailability!=='available'&&<p role="status">{detail.sourceAvailability==='missing'?'原来源已不可用，保留发布时内容。':'来源暂时无法读取，保留发布时内容。'}</p>}
      {detail.pending&&<p role="status">有待处理提交，请原提交者查询并恢复。</p>}
      {attempt&&showAttempt(attempt)}
      {parent&&detail.visibility==='published'&&detail.learningState==='approved'&&!detail.pending&&<Link
        to={`/app/practice?childId=${scope.childId}&packageId=${detail.id}`}>准备变式练习</Link>}
      {!parent&&<fieldset disabled={locked||!canSubmit||mediaBusy} className="task-editor-fields">
        <label className="family-field-wide">订正说明<textarea maxLength={1000} value={note} onChange={e=>setNote(normalize(e.target.value))} /></label>
        <Ai2Media {...mediaProps} values={mediaIds} onChange={setMediaIds} disabled={locked||!canSubmit} onBusyChange={setMediaBusy} onBlockedChange={setMediaBlocked} />
        <button type="button" className="family-button primary" disabled={!canSubmit||mediaBusy||mediaBlocked||mediaIds.length<1||mediaIds.length>10}
          onClick={()=>mutate('submit',{expectedPackageVersion:detail.stateVersion,note:normalize(note),mediaIds:[...mediaIds]})}>提交订正</button>
      </fieldset>}
      {canReview&&<fieldset disabled={locked} className="task-editor-fields"><label className="family-field-wide">审核反馈<textarea maxLength={1000} value={comment} onChange={e=>setComment(normalize(e.target.value))} /></label>
        <button type="button" className="family-button primary" disabled={!allViewed} onClick={()=>review('approve')}>通过所见订正</button>
        <button type="button" className="family-button secondary" disabled={!comment.trim()} onClick={()=>review('revise')}>退回再订正</button></fieldset>}
      {parent&&detail.visibility==='published'&&<fieldset disabled={locked} className="task-editor-fields"><label>撤回原因<input maxLength={500} value={reason} onChange={e=>setReason(normalize(e.target.value))} /></label>
        <button type="button" className="family-button secondary" disabled={!reason.trim()} onClick={()=>mutate('withdraw',{expectedPackageVersion:detail.stateVersion,reason:normalize(reason)})}>撤回学习包</button></fieldset>}
      <button type="button" className="family-button secondary" onClick={()=>refresh('history')}>查看订正历史</button>
      {history.map(a=><div key={a.id}><button type="button" className="family-button secondary" onClick={()=>refresh('attempt',1,a.id)}>查看第 {a.attemptVersion} 次订正</button></div>)}
      {history.length>0&&pager('history',history)}{oldAttempt&&showAttempt(oldAttempt,true)}
    </section>}
    {!blocked&&<><section aria-label="学习包列表"><h2>学习包</h2>{packages.map(p=><article key={p.id} className="family-record">
      <p className="ai2-text">{p.childSnapshot.questionText}</p><span>{p.visibility==='withdrawn'?'已撤回':labels[p.learningState]}</span>{' '}
      <Link to={`${base}?childId=${scope.childId}&packageId=${p.id}`}
        onClick={()=>{if(p.id===packageId)refresh('detail');}}>查看学习包内容</Link></article>)}
      {!packages.length&&<p>{loading.packages?'正在读取':'暂无学习包'}</p>}{pager('packages',packages)}</section>
      <section aria-label="本人提交记录"><h2>本人操作记录</h2>{commands.map(c=><article key={c.id} className="family-record"><p>{labels[c.phase]} · {c.createdAt}</p>
        <button type="button" className="family-button secondary" disabled={busy} onClick={()=>inspectCommand(c)}>查询原命令结果</button>
        {c.endpointOperation==='ai2.submit'&&<button type="button" className="family-button secondary" disabled={busy||Boolean(pending?.corrupt)} onClick={()=>recover(c)}>恢复原提交</button>}
      </article>)}{!commands.length&&<p>{loading.commands?'正在核对':'没有查到操作记录；这不代表未知提交已失败。'}</p>}{pager('commands',commands)}</section></>}
  </section>;
}

function LearningBoundary({role,scope,scopeVersion}) {
  const location=useLocation(),[revision,bump]=useState(0),owner=useRef({epoch:0});
  const scopeRef=useRef(scope),nextChild=useRef(null);scopeRef.current=scope;
  const session=captureSession(role),observed=useRef(session);
  useLayoutEffect(()=>{
    const reset=()=>{owner.current.epoch++;bump(v=>v+1);};
    const off=subscribeSessionChanges(event=>{if(event.role!==role)return;const next=captureSession(role);if(observed.current===next)return;observed.current=next;reset();});
    const offChild=role==='parent'?registerChildScopeReset(event=>{
      if(event.previousChildId===scopeRef.current.childId)nextChild.current=event.nextChildId;
      reset();
    }):()=>{};return()=>{off();offChild();};
  },[role]);
  const params=new URLSearchParams(location.search),g=owner.current.epoch;
  if(!session||!id(scope.familyId)||!id(scope.childId)||(role==='student'&&session.actorId!==scope.childId))return <p role="status">请登录并选择孩子。</p>;
  if((nextChild.current&&nextChild.current!==scope.childId)||(params.has('childId')&&params.get('childId')!==scope.childId))return <p role="alert">该入口不属于当前孩子。</p>;
  return <Ai2Workspace key={`${session.revision}:${scope.childId}:${scopeVersion}:${revision}:${location.search}`} scope={scope} session={session}
    packageId={params.get('packageId')} cycleId={params.get('cycleId')} currentScope={()=>owner.current.epoch===g} />;
}
export default function FamilyLearningPage(){
  const {family,selectedChildId,childScopeVersion}=useFamily();
  return <LearningBoundary role="parent" scope={{familyId:family?.familyId,childId:selectedChildId}} scopeVersion={childScopeVersion} />;
}
export function ChildLearningPage(){
  const {child}=useChildAuth();return <LearningBoundary role="student" scope={{familyId:child?.familyId,childId:child?.childId}} />;
}
