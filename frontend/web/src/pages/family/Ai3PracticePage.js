import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LeftOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons';
import { useFamily } from '../../contexts/FamilyContext';
import { useChildAuth } from '../../contexts/ChildAuthContext';
import { captureSession, isSessionCurrent, subscribeSessionChanges } from '../../services/familySession';
import { registerChildScopeReset } from '../../services/childScope';
import { createAi3Api } from '../../services/ai3Api';
import { readAi3Command, saveAi3Command, finishAi3Command, newAi3OperationId } from '../../services/ai3Commands';
import { createAi2Api } from '../../services/ai2Api';
import { getMistake, listKnowledgePoints } from '../../services/familyApi';
import Ai3Media from '../../components/family/Ai3Media';
import './Ai2LearningPage.css';
import './Ai3PracticePage.css';

const id = v => typeof v === 'string' && /^[a-f0-9]{24}$/.test(v);
const hash = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const version = v => Number.isSafeInteger(v) && v > 0;
const text = v => v.replace(/\r\n/g, '\n');
const terminal = p => ['SUCCEEDED', 'FAILED'].includes(p);
const phases = ['RESERVED','DISPATCHING','UNKNOWN','MEDIA_PREPARED','MEDIA_COMMITTED','RESOLVING','EFFECTS_PENDING','SUCCEEDED','FAILED'];
const validCommand = c => id(c?.id) && id(c.roundId) && typeof c.operationId === 'string'
  && typeof c.endpointOperation === 'string' && c.endpointOperation.startsWith('ai3.') && phases.includes(c.phase);
const validRound = r => id(r?.id) && version(r.stateVersion) && [2,3].includes(r.exerciseCount)
  && ['draft','published','withdrawn'].includes(r.visibility) && typeof r.pending === 'boolean';
const invalid = () => Object.assign(new Error('Invalid AI3 response'), { code: 'AI3_RESPONSE_INVALID' });
const denied = e => [401,403,404].includes(e?.response?.status);
const code = e => e?.response?.data?.error?.code;
const definitive = e => e?.response?.data?.success === false && (
  ([400,413].includes(e.response.status) && ['VALIDATION_ERROR','AI3_INPUT_TOO_LARGE','AI_INPUT_TOO_LARGE'].includes(code(e)))
  || (e.response.status === 409 && ['AI3_VERSION_CONFLICT','AI3_REVIEW_CONFLICT','AI3_SOURCE_NOT_APPROVED','AI3_MEDIA_UNAVAILABLE','AI3_PREVIEW_STALE','AI_PREVIEW_STALE'].includes(code(e))));
const message = e => ({ AI3_NOT_ENABLED:'变式练习尚未启用。', AI3_REVIEW_CONFLICT:'作答或审核依据已变化，请重新查看后决定。',
  AI3_VERSION_CONFLICT:'练习版本已变化，请重新查看。', AI3_MEDIA_UNAVAILABLE:'作品图片不可用，请核对后再处理。',
  AI_PROFILE_UNAVAILABLE:'生成准备尚不可用，可以在没有未决生成时手工录题。', AI3_OPERATION_UNRESOLVED:'原操作尚未结束，请查询并恢复原命令。'
}[code(e)] || '结果尚未确认，请保留原命令并重试读取。');
const labels = { open:'待作答',submitted:'等待家长审核',revise:'请再练一次',passed:'已通过',draft:'准备中',withdrawn:'已撤回',
  SUCCEEDED:'已完成',FAILED:'已确认失败',EFFECTS_PENDING:'审核已保存，记录同步待确认',UNKNOWN:'结果尚未确认',
  applied:'已写入',not_requested:'未请求',not_applied_conflict:'状态已变化，未应用',not_applied_missing:'目标已不存在，未应用',pending:'待同步',unknown:'同步待确认' };
const sourceLabels = { available:'来源可用',missing:'来源已不存在',unavailable:'来源暂不可用' };
const originLabels = { ai_generation:'生成候选',parent_manual:'家长录入',parent_revision:'家长修订' };
const contentMetadata = ['id','roundId','version','contentHash','childSnapshotHash','origin','derivedFromContentId','createdBy','createdAt'];
const validContentMetadata = (c, roundId) => id(c?.id) && c.roundId===roundId && version(c.version)
  && hash(c.contentHash) && hash(c.childSnapshotHash) && Object.hasOwn(originLabels,c.origin)
  && (c.derivedFromContentId===null || id(c.derivedFromContentId)) && id(c.createdBy)
  && typeof c.createdAt==='string' && Number.isFinite(Date.parse(c.createdAt));
const validHistoricalContent = (c, metadata, count) => validContentMetadata(c,metadata.roundId)
  && contentMetadata.every(key=>c[key]===metadata[key]) && typeof c.reason==='string'
  && typeof c.content?.instructions==='string' && Array.isArray(c.content.exercises) && c.content.exercises.length===count
  && c.content.exercises.every((q,i)=>q?.exerciseId===`q${i+1}`
    && ['questionText','answerForParent','rubricForParent'].every(key=>typeof q[key]==='string'))
  && c.childSnapshot?.instructions===c.content.instructions && Array.isArray(c.childSnapshot.exercises)
  && c.childSnapshot.exercises.length===count && c.childSnapshot.exercises.every((q,i)=>q?.exerciseId===c.content.exercises[i].exerciseId
    && q.questionText===c.content.exercises[i].questionText);
const actionMethod = { revise_content:'reviseContent', reject_content:'rejectContent' };
const IconButton = ({ label, children, ...props }) => <button type="button" className="family-button secondary" title={label} aria-label={label} {...props}>{children}</button>;
const Questions = ({ value, parent = false }) => <div className="ai2-snapshot"><p className="ai2-text">{value.instructions}</p>
  {value.exercises.map((q,i) => <article className="family-record" key={q.exerciseId}><h3>第 {i+1} 题</h3><p className="ai2-text">{q.questionText}</p>
    {parent && <><strong>家长答案</strong><p className="ai2-text">{q.answerForParent}</p><strong>判定要点</strong><p className="ai2-text">{q.rubricForParent}</p></>}</article>)}</div>;
const emptyContent = count => ({ instructions:'在纸上写出计算过程，并按题号提交照片。',
  exercises:Array.from({ length:count },(_,i)=>({ exerciseId:`q${i+1}`,questionText:'',answerForParent:'',rubricForParent:'' })) });

export function Ai3Workspace({ scope, session, roundId, packageId, currentScope }) {
  const parent = session.role === 'parent', api = useMemo(()=>createAi3Api(session.role),[session.role]);
  const sourceApi = useMemo(()=>createAi2Api('parent'),[]), base = parent ? '/app/practice' : '/child/practice';
  const [rows,setRows]=useState([]),[commands,setCommands]=useState([]),[detail,setDetail]=useState(null),[attempt,setAttempt]=useState(null);
  const [knownCommands,setKnownCommands]=useState({});
  // Pagination is only presentation; a known unresolved command survives empty pages and failed reads.
  const rememberCommands=items=>setKnownCommands(previous=>{
    const next={...previous};
    for(const item of items)if(!terminal(previous[item.id]?.phase))next[item.id]=item;
    return next;
  });
  const [history,setHistory]=useState([]),[oldAttempt,setOldAttempt]=useState(null),[pages,setPages]=useState({rounds:1,commands:1,history:1,contents:1});
  const [contentHistory,setContentHistory]=useState(null),[oldContent,setOldContent]=useState(null);
  const [source,setSource]=useState(null),[points,setPoints]=useState([]),[pointId,setPointId]=useState(''),[count,setCount]=useState(2);
  const [preview,setPreview]=useState(null),[generation,setGeneration]=useState(null),[context,setContext]=useState(null);
  const [editor,setEditor]=useState(null),[reason,setReason]=useState(''),[consent,setConsent]=useState(false),[sendConsent,setSendConsent]=useState(false);
  const [note,setNote]=useState(''),[media,setMedia]=useState([]),[mediaBusy,setMediaBusy]=useState(false),[mediaBlocked,setMediaBlocked]=useState(true);
  const [viewed,setViewed]=useState([]),[mediaEpoch,setMediaEpoch]=useState(0),[comment,setComment]=useState(''),[summary,setSummary]=useState('');
  const [mastery,setMastery]=useState(false),[date,setDate]=useState(''),[filters,setFilters]=useState({reviewFrom:'',reviewTo:''});
  const [busy,setBusy]=useState(false),[blocked,setBlocked]=useState(false),[discovered,setDiscovered]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [pending,setPending]=useState(()=>{try{return readAi3Command(scope,session);}catch{return {corrupt:true};}}),[resultRound,setResultRound]=useState(null);
  const state=useRef({live:true,epoch:0,viewEpoch:0,requests:{},writing:false});
  const current=g=>state.current.live && state.current.epoch===g && isSessionCurrent(session) && currentScope();
  const cancelReads=()=>{Object.values(state.current.requests).forEach(c=>c.abort());state.current.requests={};};
  useLayoutEffect(()=>{const s=state.current;s.live=true;return()=>{s.live=false;s.epoch++;Object.values(s.requests).forEach(c=>c.abort());};},[]);
  const clearReview=()=>{setContext(null);setViewed([]);setComment('');setSummary('');setMastery(false);setDate('');setMediaEpoch(v=>v+1);};
  const clearContentHistory=()=>{for(const kind of ['contents','content']){state.current.requests[kind]?.abort();delete state.current.requests[kind];}
    setContentHistory(null);setOldContent(null);setPages(v=>({...v,contents:1}));};
  const clearDetails=()=>{setDetail(null);setAttempt(null);setOldAttempt(null);setHistory([]);setPreview(null);setGeneration(null);setEditor(null);setConsent(false);setSendConsent(false);clearContentHistory();clearReview();};
  const deny=()=>{state.current.epoch++;cancelReads();state.current.writing=false;setBusy(false);setBlocked(true);setDiscovered(false);
    clearDetails();setSource(null);setPoints([]);setRows([]);setCommands([]);setKnownCommands({});setPending(null);setNote('');setMedia([]);setNotice('');setResultRound(null);
    setError('当前身份无法查看这些私有练习。');};
  const owns=async(options,g,target,kind='round')=>{
    for(let page=1;current(g)&&!options.signal.aborted;page++){
      const data=kind==='round'?await api.rounds(scope.childId,page,options):await sourceApi.packages(scope.childId,page,options);
      if(!current(g)||options.signal.aborted)return false;
      if(!Array.isArray(data?.items))throw invalid();
      if(data.items.some(r=>r.id===target))return true;
      if(data.items.length<20){deny();return false;}
    }
    return false;
  };
  const refresh=async(kind,page=1,target)=>{
    const g=state.current.epoch;if(!current(g)||blocked)return;
    const contentRead=kind==='contents'||kind==='content';
    if(contentRead&&(!parent||!id(roundId)||!detail))return;
    const selected=kind==='content'?contentHistory?.find(c=>c.id===target):null;
    if(kind==='content'&&!selected)return;
    if(contentRead){setOldContent(null);if(kind==='contents'){state.current.requests.content?.abort();delete state.current.requests.content;}}
    state.current.requests[kind]?.abort();const controller=new AbortController();state.current.requests[kind]=controller;
    const options={session,signal:controller.signal};
    try{
      let data;
      if(kind==='detail'){
        if(!id(roundId)||(parent&&!await owns(options,g,roundId)))return;
        data=await api.detail(roundId,options);
      }else if(kind==='source'){
        if(!parent||!id(packageId)||!await owns(options,g,packageId,'source'))return;
        data=await sourceApi.detail(packageId,options);
        if(!current(g)||controller.signal.aborted||state.current.requests[kind]!==controller)return;
        const p=data?.package,a=p?.attempts?.find(v=>v.id===p.currentAttemptId);
        if(p?.id!==packageId||p.visibility!=='published'||p.learningState!=='approved'||a?.review?.decision!=='approve'
          ||!hash(a.sourceReviewHash)||!hash(a.attemptPayloadHash))throw invalid();
        if(p.source?.type==='mistake'){
          const value=await getMistake(p.source.id,controller.signal,session);if(!current(g))return;
          const m=value?.mistake;if(!m||m.childId!==scope.childId)throw invalid();data={...data,pointId:m.knowledgePointId||null};
        }else{
          const available=[];
          for(let page=1;;page++){
            const value=await listKnowledgePoints({childId:scope.childId,dimension:'academic',page,pageSize:100},controller.signal);
            if(!current(g)||controller.signal.aborted||state.current.requests[kind]!==controller)return;
            if(!Array.isArray(value?.items))throw invalid();
            available.push(...value.items.filter(p=>p.dimension==='academic'&&typeof p.subject==='string'
              &&['math','数学'].includes(p.subject.trim().replace(/[A-Z]/g,c=>c.toLowerCase()))));
            if(value.items.length<100)break;
          }
          setPoints(available);
        }
      }else if(kind==='contents')data=await api.contents(roundId,page,options);
      else if(kind==='content')data=await api.content(roundId,target,options);
      else if(kind==='history')data=await api.attempts(roundId,page,options);
      else if(kind==='attempt')data=await api.attempt(roundId,target,options);
      else data=kind==='rounds'?await api.rounds(scope.childId,page,options,filters):await api.commands(scope.childId,page,options);
      if(!current(g)||controller.signal.aborted||state.current.requests[kind]!==controller)return;
      if(kind==='detail'){
        if(!validRound(data?.round)||data.round.id!==roundId)throw invalid();
        state.current.viewEpoch++;state.current.requests.attempt?.abort();latestDetail.current=data.round;
        setDetail(data.round);setAttempt(null);setOldAttempt(null);setPreview(null);setGeneration(null);setConsent(false);setSendConsent(false);clearContentHistory();clearReview();
        if(id(data.round.currentAttemptId))latest.current('attempt',1,data.round.currentAttemptId);
      }else if(kind==='attempt'){
        if(data?.attempt?.id!==target||!Array.isArray(data.attempt.media))throw invalid();
        if(target===latestDetail.current?.currentAttemptId)setAttempt(data.attempt);else setOldAttempt(data.attempt);
      }else if(kind==='source'){setSource(data.package);setPointId(data.pointId||'');}
      else if(kind==='content'){
        if(!validHistoricalContent(data?.content,selected,detail.exerciseCount))throw invalid();
        setOldContent(data.content);
      }
      else{
        if(!Array.isArray(data?.items))throw invalid();
        if(kind==='rounds'){if(data.items.some(r=>!validRound(r)))throw invalid();setRows(data.items);}
        else if(kind==='commands'){if(data.items.some(c=>!validCommand(c)))throw invalid();rememberCommands(data.items);setCommands(data.items);setDiscovered(true);}
        else if(kind==='contents'){
          if(data.page!==page||data.pageSize!==20||data.items.length>20
            ||data.items.some(c=>!validContentMetadata(c,roundId)||Object.keys(c).length!==contentMetadata.length)
            ||new Set(data.items.map(c=>c.id)).size!==data.items.length)throw invalid();
          setContentHistory(data.items);
        }else setHistory(data.items);
        setPages(v=>({...v,[kind]:page}));
      }
      setError('');
    }catch(cause){if(!current(g)||(contentRead&&(controller.signal.aborted||state.current.requests[kind]!==controller)))return;
      if(denied(cause)){deny();return;}if(state.current.requests[kind]===controller&&cause.code!=='ERR_CANCELED')setError(message(cause));}
  };
  const latest=useRef(refresh);latest.current=refresh;
  const latestDetail=useRef(detail);latestDetail.current=detail;
  useEffect(()=>{latest.current('rounds');latest.current('commands');if(id(roundId))latest.current('detail');if(parent&&id(packageId))latest.current('source');},[roundId,packageId,parent]);
  const foreground=useRef();foreground.current=()=>{if(blocked||document.visibilityState==='hidden')return;
    latest.current('rounds',pages.rounds);latest.current('commands',pages.commands);if(id(roundId))latest.current('detail');};
  useEffect(()=>{const run=()=>foreground.current();window.addEventListener('focus',run);window.addEventListener('pageshow',run);document.addEventListener('visibilitychange',run);
    return()=>{window.removeEventListener('focus',run);window.removeEventListener('pageshow',run);document.removeEventListener('visibilitychange',run);};},[]);
  const unresolvedCommands=Object.values(knownCommands).filter(c=>!terminal(c.phase));
  const displayedCommands=[...commands.map(c=>knownCommands[c.id]||c),...unresolvedCommands.filter(c=>!commands.some(item=>item.id===c.id))];
  const locked=blocked||busy||Boolean(pending)||unresolvedCommands.length>0||!discovered;
  const accept=(data,original,expectedId)=>{
    const c=data?.command;if(!validCommand(c)||c.operationId!==original.body.operationId||c.endpointOperation!==`ai3.${original.action}`
      ||(expectedId&&c.id!==expectedId)||(original.targetId&&c.roundId!==original.targetId))throw invalid();
    rememberCommands([c]);
    if(!terminal(c.phase)){setNotice(c.phase==='EFFECTS_PENDING'?'审核已保存，记录同步待确认。':'原操作仍未结束，请查询并恢复原命令。');latest.current('commands');return;}
    finishAi3Command(scope,original.body.operationId,session);setPending(readAi3Command(scope,session));
    state.current.epoch++;cancelReads();state.current.writing=false;setBusy(false);clearDetails();setNote('');setMedia([]);setMediaBlocked(true);setMediaBusy(false);
    setNotice(c.phase==='FAILED'?'原操作已确认失败，未发布新的内容。':'原命令已完成，请重新查看练习。');setResultRound(c.roundId);
    latest.current('commands');latest.current('rounds');
  };
  const execute=async saved=>{
    const g=state.current.epoch;if(!current(g)||blocked||state.current.writing||saved?.corrupt)return;
    let original;try{original=saveAi3Command(scope,saved,session);}catch{setError('原命令暂存不可用，尚未发送。');return;}
    setPending(original);state.current.writing=true;setBusy(true);setError('');
    try{
      const options={session};const method=actionMethod[original.action]||original.action;
      const data=original.action==='create'?await api.create(original.body,options):original.action==='review'
        ?await api.review(original.targetId,original.attemptId,original.body,options):await api[method](original.targetId,original.body,options);
      if(current(g))accept(data,original);
    }catch(cause){if(!current(g))return;if(denied(cause)){deny();return;}
      if(definitive(cause)){finishAi3Command(scope,original.body.operationId,session);setPending(null);
        if(cause.response.status===409){state.current.epoch++;cancelReads();clearDetails();state.current.writing=false;setBusy(false);}}
      setError(message(cause));
    }finally{if(current(g)){state.current.writing=false;setBusy(false);}}
  };
  const mutate=(action,body,attemptId=null)=>{if(locked||state.current.writing||!current(state.current.epoch))return;
    execute({action,targetId:action==='create'?null:roundId,attemptId,body:{schemaVersion:'ai3-min-v1',operationId:newAi3OperationId(),...body}});};
  const readCommand=async(item,recover=false)=>{
    const g=state.current.epoch;if(!current(g)||blocked||state.current.writing)return;state.current.writing=true;setBusy(true);
    try{
      const data=recover?await api.recover(item.id,{schemaVersion:'ai3-min-v1',operationId:item.operationId},{session}):await api.command(item.id,{session});
      if(!current(g))return;if(!validCommand(data?.command)||data.command.id!==item.id||data.command.operationId!==item.operationId||data.command.endpointOperation!==item.endpointOperation||data.command.roundId!==item.roundId)throw invalid();
      rememberCommands([data.command]);
      const local=readAi3Command(scope,session),original={action:item.endpointOperation.slice(4),targetId:item.roundId,body:{operationId:item.operationId}};
      if(recover||(terminal(data.command.phase)&&local&&!local.corrupt&&local.body.operationId===item.operationId&&`ai3.${local.action}`===item.endpointOperation)){accept(data,original,item.id);}
      else {setNotice(labels[data.command.phase]||'操作尚未结束');setResultRound(item.roundId);latest.current('commands');}
    }catch(cause){if(current(g)){if(denied(cause))deny();else setError(message(cause));}}
    finally{if(current(g)){state.current.writing=false;setBusy(false);}}
  };
  const loadPreview=async kind=>{
    const g=state.current.epoch,v=state.current.viewEpoch;if(locked||!current(g)||!detail)return;setBusy(true);
    try{
      const data=kind==='review'?await api.reviewContext(roundId,attempt.id,{session}):await api[kind==='generation'?'generationPreview':'publicationPreview'](roundId,{session});
      if(!current(g)||v!==state.current.viewEpoch)return;
      if(kind==='review'){
        if(data.roundId!==roundId||data.expectedRoundVersion!==detail.stateVersion||data.attemptId!==attempt.id
          ||data.expectedAttemptVersion!==attempt.attemptVersion||data.attemptPayloadHash!==attempt.attemptPayloadHash
          ||data.contentId!==detail.currentContentId||data.contentVersion!==detail.currentContentVersion
          ||data.contentHash!==detail.currentContentHash||!hash(data.reviewContextHash))throw invalid();
        setContext(data);setMastery(false);setSummary('');setDate('');
      }else if(kind==='generation'){if(!data?.preview||!hash(data.preview.generationInputHash))throw invalid();setGeneration(data.preview);setSendConsent(false);}
      else{const p=data?.preview;if(p?.roundId!==roundId||p.expectedRoundVersion!==detail.stateVersion||!p.content||!p.childSnapshot||!hash(p.childSnapshotHash))throw invalid();setPreview(p);setConsent(false);}
    }catch(cause){if(current(g)){if(denied(cause))deny();else setError(message(cause));}}
    finally{if(current(g))setBusy(false);}
  };
  const canDraft=!parent&&detail?.visibility==='published'&&['open','revise'].includes(detail.learningState);
  const canSubmit=canDraft&&!detail.pending;
  const canReview=parent&&detail?.visibility==='published'&&detail.learningState==='submitted'&&!detail.pending&&attempt&&!attempt.review
    &&attempt.id===detail.currentAttemptId&&attempt.attemptVersion===detail.currentAttemptVersion;
  const allViewed=attempt?.media?.length>0&&attempt.media.every(m=>m.status==='available'&&viewed.includes(m.mediaId));
  const review=decision=>mutate('review',{expectedRoundVersion:detail.stateVersion,contentId:detail.currentContentId,contentVersion:detail.currentContentVersion,
    contentHash:detail.currentContentHash,expectedAttemptVersion:attempt.attemptVersion,attemptPayloadHash:attempt.attemptPayloadHash,
    decision,comment:text(comment),evidenceSummary:decision==='approve'?text(summary):'',masteryConfirmed:decision==='approve'&&mastery,
    reviewReminderDate:decision==='approve'&&date?date:null,reviewContextHash:decision==='approve'?context.reviewContextHash:null},attempt.id);
  const mediaProps={role:session.role,session,childId:scope.childId,scopeKey:`${session.revision}:${scope.childId}:${roundId}`,onDenied:()=>{if(current(state.current.epoch))deny();}};
  const showAttempt=(a,old=false)=><article className="ai2-attempt"><h3>{old?'历史作答':'当前作答'} · 第 {a.attemptVersion} 次</h3><p className="ai2-text">{a.note}</p>
    <Ai3Media {...mediaProps} key={`${a.id}:${mediaEpoch}`} scopeKey={`${mediaProps.scopeKey}:view:${a.id}:${mediaEpoch}`} values={a.media} readOnly
      onViewed={(mediaId,yes=true)=>{if(!old)setViewed(v=>yes?[...new Set([...v,mediaId])]:v.filter(x=>x!==mediaId));}}
      onDeleted={mediaId=>{setViewed(v=>v.filter(x=>x!==mediaId));setContext(null);const mark=value=>value?{...value,media:value.media.map(m=>m.mediaId===mediaId?{...m,status:'deleted'}:m)}:value;
        setAttempt(mark);setOldAttempt(mark);}} />
    {a.review&&<p className="ai2-text">家长反馈：{a.review.decision==='approve'?'通过':'请再练一次'} {a.review.comment}</p>}</article>;
  const pager=(kind,items)=>{const label=kind==='contents'?'题组历史':kind;
    return <nav className="family-inline-actions" aria-label={`${label}分页`}><IconButton label={`${label}上一页`} disabled={blocked||pages[kind]<=1} onClick={()=>refresh(kind,pages[kind]-1)}><LeftOutlined /></IconButton>
      <span>第 {pages[kind]} 页</span><IconButton label={`${label}下一页`} disabled={blocked||items.length<20} onClick={()=>refresh(kind,pages[kind]+1)}><RightOutlined /></IconButton></nav>;};
  return <section className="family-page ai2-page ai3-page" aria-labelledby="ai3-title">
    <div className="family-page-heading"><h1 id="ai3-title">{parent?'变式练习与审核':'我的变式练习'}</h1><IconButton label="刷新练习记录" disabled={blocked} onClick={()=>foreground.current()}><ReloadOutlined /></IconButton></div>
    {id(roundId)&&<IconButton label="刷新练习详情" disabled={blocked} onClick={()=>refresh('detail')}><ReloadOutlined /></IconButton>}
    {error&&<p role="alert" className="family-form-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
    {!blocked&&resultRound&&<Link to={`${base}?childId=${scope.childId}&roundId=${resultRound}`} onClick={()=>{if(resultRound===roundId)refresh('detail');}}>查看练习</Link>}
    {!blocked&&pending&&<section aria-label="未确认原命令"><p>{pending.corrupt?'本地命令损坏，请查询本人操作记录或退出重登，不能再次发送。':'原操作尚未确认，新操作已暂停。'}</p>
      {!pending.corrupt&&pending.action==='generate'&&<p>生成结果只能查询本人操作记录并恢复原操作，不能再次发送。</p>}
      {!pending.corrupt&&pending.action!=='generate'&&<button type="button" className="family-button secondary" disabled={busy} onClick={()=>execute(pending)}>重试原命令</button>}</section>}
    {!blocked&&parent&&source&&<section aria-label="准备变式练习"><h2>准备变式练习</h2><p>{source.childSnapshot.questionText}</p>
      <fieldset disabled={locked}><label>题量<select value={count} onChange={e=>setCount(Number(e.target.value))}><option value={2}>2 题</option><option value={3}>3 题</option></select></label>
        {source.source?.type==='task'&&<label>关联知识点<select value={pointId} onChange={e=>setPointId(e.target.value)}><option value="">不关联</option>{points.map(p=><option key={p.knowledgePointId} value={p.knowledgePointId}>{p.name}</option>)}</select></label>}
        <button type="button" className="family-button" onClick={()=>{const a=source.attempts.find(v=>v.id===source.currentAttemptId);mutate('create',{
          sourcePackageId:source.id,expectedSourcePackageVersion:source.stateVersion,sourceAttemptId:a.id,expectedSourceAttemptVersion:a.attemptVersion,
          sourceAttemptPayloadHash:a.attemptPayloadHash,sourceReviewHash:a.sourceReviewHash,exerciseCount:count,knowledgePointId:pointId||null});}}>创建练习轮次</button></fieldset></section>}
    {!blocked&&detail&&<section aria-label="练习详情"><h2>{labels[detail.visibility==='published'?detail.learningState:detail.visibility]||detail.learningState}</h2>
      {Object.hasOwn(sourceLabels,detail.sourceAvailability)&&<p role="status">{sourceLabels[detail.sourceAvailability]}</p>}
      {(parent?detail.content:detail.childSnapshot)&&<Questions value={parent?detail.content:detail.childSnapshot} parent={parent} />}
      {detail.reviewReminderDate&&<p>复习日期：{detail.reviewReminderDate}</p>}
      {parent&&detail.effects&&<p>错题记录：{labels[detail.effects.mistake]||detail.effects.mistake}；掌握证据：{labels[detail.effects.mastery]||detail.effects.mastery}</p>}
      {detail.pending&&<p role="status">有未结束的操作，请原操作人查询并恢复。</p>}
      {parent&&detail.visibility==='draft'&&!detail.cancelledAt&&<section aria-label="题组准备"><div className="family-inline-actions">
        <button type="button" className="family-button secondary" disabled={locked} onClick={()=>{setEditor({content:JSON.parse(JSON.stringify(detail.content||emptyContent(detail.exerciseCount))),
          expectedRoundVersion:detail.stateVersion,expectedContentId:detail.currentContentId,expectedContentVersion:detail.currentContentVersion||null,expectedContentHash:detail.currentContentHash||null});setReason('');}}>手工录题或修订</button>
        <button type="button" className="family-button secondary" disabled={locked} onClick={()=>loadPreview('generation')}>查看完整生成请求</button>
        {detail.content&&<button type="button" className="family-button" disabled={locked} onClick={()=>loadPreview('publication')}>查看发布预览</button>}</div>
        {editor&&<fieldset disabled={locked}><label>作答要求<textarea maxLength={500} value={editor.content.instructions} onChange={e=>setEditor(v=>({...v,content:{...v.content,instructions:text(e.target.value)}}))} /></label>
          {editor.content.exercises.map((q,i)=><div className="task-editor-fields" key={q.exerciseId}>{[['questionText','题干'],['answerForParent','家长答案'],['rubricForParent','判定要点']].map(([field,label])=><label key={field}>第 {i+1} 题{label}
            <textarea maxLength={1000} value={q[field]} onChange={e=>setEditor(v=>({...v,content:{...v.content,exercises:v.content.exercises.map((x,j)=>j===i?{...x,[field]:text(e.target.value)}:x)}}))} /></label>)}</div>)}
          <label>修订原因<input maxLength={500} value={reason} onChange={e=>setReason(text(e.target.value))} /></label>
          <button type="button" className="family-button" disabled={!reason.trim()||!editor.content.instructions.trim()||editor.content.exercises.some(q=>!q.questionText.trim()||!q.answerForParent.trim()||!q.rubricForParent.trim())}
            onClick={()=>mutate('revise_content',{...editor,reason})}>保存题组版本</button></fieldset>}
        {generation&&<section aria-label="完整生成预览"><h3>完整生成请求</h3><pre className="ai2-text" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(generation,null,2)}</pre>
          <label><input type="checkbox" checked={sendConsent} disabled={locked} onChange={e=>setSendConsent(e.target.checked)} />已核对完整请求、脱敏内容与本次费用上限</label>
          <button type="button" className="family-button" disabled={locked||!sendConsent} onClick={()=>mutate('generate',{expectedRoundVersion:detail.stateVersion,
            generationInputHash:generation.generationInputHash,modelProfileVersion:generation.modelProfileVersion,pricingProfileVersion:generation.pricingProfileVersion,
            maxAuthorizedCostMicros:generation.reservedCeilingMicros,externalSendConfirmed:true,deidentifiedConfirmed:true})}>生成候选题组</button></section>}
        {preview&&<section aria-label="发布预览"><h3>家长全文</h3><Questions value={preview.content} parent /><h3>孩子可见内容</h3><Questions value={preview.childSnapshot} />
          <label><input type="checkbox" disabled={locked} checked={consent} onChange={e=>setConsent(e.target.checked)} />已核算全部答案和判定要点，并确认孩子可见内容</label>
          <button type="button" className="family-button" disabled={locked||!consent} onClick={()=>{const {content:_c,childSnapshot:_s,roundId:_r,...fields}=preview;mutate('publish',{...fields,childContentConfirmed:true,answersChecked:true});}}>批准并发布</button></section>}
      </section>}
      {attempt&&showAttempt(attempt)}
      {canDraft&&<fieldset disabled={locked||mediaBusy||!canSubmit}><label>作答说明<textarea maxLength={1000} value={note} onChange={e=>setNote(text(e.target.value))} /></label>
        <Ai3Media {...mediaProps} values={media} onChange={setMedia} disabled={locked||!canSubmit} onBusyChange={setMediaBusy} onBlockedChange={setMediaBlocked} />
        <button type="button" className="family-button" disabled={locked||!canSubmit||mediaBusy||mediaBlocked||media.length<1||media.length>10} onClick={()=>mutate('submit',{
          expectedRoundVersion:detail.stateVersion,contentId:detail.contentId,contentVersion:detail.contentVersion,childSnapshotHash:detail.childSnapshotHash,note,mediaIds:[...media]})}>提交作答</button></fieldset>}
      {canReview&&<fieldset disabled={locked}><label>审核反馈<textarea maxLength={1000} value={comment} onChange={e=>setComment(text(e.target.value))} /></label>
        <button type="button" className="family-button secondary" disabled={!comment.trim()} onClick={()=>review('revise')}>退回再练</button>
        <button type="button" className="family-button secondary" disabled={!allViewed} onClick={()=>loadPreview('review')}>读取审核依据</button>
        {context&&<><label>整组核对说明<textarea maxLength={1000} value={summary} onChange={e=>setSummary(text(e.target.value))} /></label>
          <label><input type="checkbox" disabled={!context.targets.knowledgePoint} checked={mastery} onChange={e=>setMastery(e.target.checked)} />确认已掌握关联知识点</label>
          <label>复习日期<input type="date" value={date} onChange={e=>setDate(e.target.value)} /></label>
          <button type="button" className="family-button" disabled={!allViewed||!summary.trim()} onClick={()=>review('approve')}>通过所见练习</button></>}</fieldset>}
      {parent&&!detail.cancelledAt&&detail.visibility!=='withdrawn'&&<fieldset disabled={locked}><label>停止原因<input maxLength={500} value={reason} onChange={e=>setReason(text(e.target.value))} /></label>
        <button type="button" className="family-button secondary" disabled={!reason.trim()} onClick={()=>mutate(detail.visibility==='draft'?'cancel':'withdraw',{expectedRoundVersion:detail.stateVersion,reason})}>{detail.visibility==='draft'?'取消准备':'撤回练习'}</button>
        {detail.visibility==='draft'&&detail.currentContentId&&<button type="button" className="family-button secondary" disabled={!reason.trim()} onClick={()=>mutate('reject_content',{
          expectedRoundVersion:detail.stateVersion,contentId:detail.currentContentId,contentVersion:detail.currentContentVersion,contentHash:detail.currentContentHash,reason})}>拒绝当前候选</button>}</fieldset>}
      {parent&&<section aria-label="题组历史"><button type="button" className="family-button secondary" onClick={()=>refresh('contents')}>查看题组历史</button>
        {contentHistory&&<>{contentHistory.map(c=><article className="family-record" key={c.id}>
          <button type="button" className="family-button secondary" onClick={()=>refresh('content',1,c.id)}>查看第 {c.version} 版题组</button>
          <div className="family-record-main"><p className="ai2-text">{originLabels[c.origin]} · {c.createdAt}</p><p className="ai2-text">创建人：{c.createdBy}</p></div>
        </article>)}{!contentHistory.length&&<p>暂无题组历史。</p>}{pager('contents',contentHistory)}</>}
        {oldContent&&<section aria-label="历史题组详情"><h3>历史题组 · 第 {oldContent.version} 版</h3>
          <p>{originLabels[oldContent.origin]}</p><p className="ai2-text">创建人：{oldContent.createdBy} · {oldContent.createdAt}</p>
          {oldContent.derivedFromContentId&&<p className="ai2-text">来源版本 ID：{oldContent.derivedFromContentId}</p>}
          <p className="ai2-text">{oldContent.reason}</p><Questions value={oldContent.content} parent />
        </section>}
      </section>}
      <button type="button" className="family-button secondary" onClick={()=>refresh('history')}>查看作答历史</button>
      {history.map(a=><button type="button" className="family-button secondary" key={a.id} onClick={()=>refresh('attempt',1,a.id)}>查看第 {a.attemptVersion} 次作答</button>)}
      {history.length>0&&pager('history',history)}{oldAttempt&&showAttempt(oldAttempt,true)}
    </section>}
    {!blocked&&<><section aria-label="练习列表"><h2>练习记录</h2><div className="family-inline-actions">
      <label>复习开始<input type="date" value={filters.reviewFrom} onChange={e=>setFilters(v=>({...v,reviewFrom:e.target.value}))} /></label>
      <label>复习结束<input type="date" value={filters.reviewTo} onChange={e=>setFilters(v=>({...v,reviewTo:e.target.value}))} /></label>
      <button type="button" className="family-button secondary" onClick={()=>refresh('rounds')}>查询复习记录</button></div>
      {rows.map(r=><article className="family-record" key={r.id}><span>{r.exerciseCount} 题 · {labels[r.learningState]||labels[r.visibility]}</span>{' '}
        <Link to={`${base}?childId=${scope.childId}&roundId=${r.id}`} onClick={()=>{if(r.id===roundId)refresh('detail');}}>查看练习内容</Link>{r.reviewReminderDate&&<span> · {r.reviewReminderDate}</span>}</article>)}
      {!rows.length&&<p>暂无练习记录</p>}{pager('rounds',rows)}</section>
      <section aria-label="本人操作记录"><h2>本人操作记录</h2>{displayedCommands.map(c=><article className="family-record" key={c.id}><p>{labels[c.phase]||'处理中'} · {c.createdAt}</p>
        <button type="button" className="family-button secondary" disabled={busy} onClick={()=>readCommand(c)}>查询原操作</button>
        {['ai3.generate','ai3.submit','ai3.review'].includes(c.endpointOperation)&&<button type="button" className="family-button secondary" disabled={busy} onClick={()=>readCommand(c,true)}>恢复原操作</button>}</article>)}
        {!displayedCommands.length&&<p>没有查到操作记录；这不代表未知写入已经失败。</p>}{pager('commands',commands)}</section></>}
  </section>;
}

function PracticeBoundary({role,scope,scopeVersion}) {
  const location=useLocation(),[revision,bump]=useState(0),owner=useRef({epoch:0}),scopeRef=useRef(scope),nextChild=useRef(null);scopeRef.current=scope;
  const session=captureSession(role),observed=useRef(session);
  useLayoutEffect(()=>{const reset=()=>{owner.current.epoch++;bump(v=>v+1);};
    const off=subscribeSessionChanges(event=>{if(event.role!==role)return;const next=captureSession(role);if(observed.current===next)return;observed.current=next;reset();});
    const offChild=role==='parent'?registerChildScopeReset(event=>{if(event.previousChildId===scopeRef.current.childId)nextChild.current=event.nextChildId;reset();}):()=>{};
    return()=>{off();offChild();};},[role]);
  const query=new URLSearchParams(location.search),g=owner.current.epoch;
  if(!session||!id(scope.familyId)||!id(scope.childId)||(role==='student'&&session.actorId!==scope.childId))return <p role="status">请登录并选择孩子。</p>;
  if((nextChild.current&&nextChild.current!==scope.childId)||(query.has('childId')&&query.get('childId')!==scope.childId))return <p role="alert">该入口不属于当前孩子。</p>;
  return <Ai3Workspace key={`${session.revision}:${scope.childId}:${scopeVersion}:${revision}:${location.search}`} scope={scope} session={session}
    roundId={query.get('roundId')} packageId={query.get('packageId')} currentScope={()=>owner.current.epoch===g} />;
}
export default function FamilyPracticePage(){const {family,selectedChildId,childScopeVersion}=useFamily();
  return <PracticeBoundary role="parent" scope={{familyId:family?.familyId,childId:selectedChildId}} scopeVersion={childScopeVersion} />;}
export function ChildPracticePage(){const {child}=useChildAuth();return <PracticeBoundary role="student" scope={{familyId:child?.familyId,childId:child?.childId}} />;}
