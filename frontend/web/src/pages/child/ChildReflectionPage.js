import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ReflectionPanel from '../../components/family/ReflectionPanel';
import { useChildAuth } from '../../contexts/ChildAuthContext';
import { getOwnProfile } from '../../services/childApi';
import { isSessionCurrent } from '../../services/familySession';
import { familyLocalDate } from '../../services/dailyLearningPlan';
import { assertLearningScope, learningReadMessage } from '../../services/learningSources';
import { reflectionWeek } from '../../services/reflection';

const ScopedReflectionPage = ({ child, session }) => {
  const [query, setQuery] = useSearchParams();
  const [profile, setProfile] = useState(null), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const load = async () => {
      setError(''); setProfile(null);
      try {
        const result = await getOwnProfile({ signal: controller.signal, session });
        if (!active || !isSessionCurrent(session)) return;
        assertLearningScope(result?.child, 'childId', child.childId, child.familyId, child.childId);
        const today = familyLocalDate(result.timezone);
        setProfile({ ...result.child, today });
      } catch (cause) {
        if (active && isSessionCurrent(session)) setError(learningReadMessage(cause));
      }
    };
    load();
    return () => { active = false; controller.abort(); };
  }, [child.childId, child.familyId, session, attempt]);
  let weekStart, invalidDate = false;
  if (profile) {
    try { weekStart = reflectionWeek(query.get('weekStart') || profile.today).from; }
    catch { invalidDate = true; }
  }
  return <section className="child-page" aria-labelledby="reflection-page-title">
    <div className="child-page-heading"><h1 id="reflection-page-title">本周反思</h1><Link className="child-back-link" to="/child/today">返回今天</Link></div>
    {error && <div role="alert">{error}<button type="button" className="family-button" onClick={() => setAttempt(n => n + 1)}>重试读取资料</button></div>}
    {!profile && !error && <p role="status">正在读取资料…</p>}
    {profile && <>
      <label>反思所在周<input type="date" value={weekStart || ''} onChange={event => {
        if (!event.target.value) return;
        setQuery({ weekStart: reflectionWeek(event.target.value).from });
      }} /></label>
      {invalidDate ? <p role="alert">请选择有效日期。</p> : <ReflectionPanel role="student" familyId={child.familyId}
        childId={child.childId} grade={profile.grade} weekStart={weekStart} />}
    </>}
  </section>;
};

const ChildReflectionPage = () => {
  const { child, sessionSnapshot } = useChildAuth();
  if (!child || !isSessionCurrent(sessionSnapshot)) return <p role="alert">请重新登录后查看反思。</p>;
  return <ScopedReflectionPage child={child} session={sessionSnapshot}
    key={`${sessionSnapshot.revision}:${child.childId}:${child.familyId}`} />;
};
export default ChildReflectionPage;
