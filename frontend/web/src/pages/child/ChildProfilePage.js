import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import FamilyDataState from '../../components/family/FamilyDataState';
import { useChildAuth } from '../../contexts/ChildAuthContext';
import { useChildDataResource } from '../../hooks/useChildDataResource';
import { getOwnProfile } from '../../services/childApi';

const ProfileValues = ({ values }) => {
  if (!Array.isArray(values) || values.length === 0) return <p>暂未填写</p>;
  return <ul>{values.map((value) => <li key={value}>{value}</li>)}</ul>;
};

const ChildProfilePage = () => {
  const navigate = useNavigate();
  const { logout } = useChildAuth();
  const loadProfile = useCallback(async ({ signal }) => {
    const result = await getOwnProfile(signal);
    return result?.child || null;
  }, []);
  const resource = useChildDataResource({ load: loadProfile });
  const profile = resource.data;

  const handleLogout = () => {
    logout();
    navigate('/child/login', { replace: true });
  };

  if (resource.state === 'loading') return <FamilyDataState state="loading" />;
  if (resource.state === 'retryable_error') {
    return <FamilyDataState state="retryable_error" onRetry={resource.reload} />;
  }
  if (resource.state === 'error') return <FamilyDataState state="error" error={resource.error} />;
  if (!profile) return <FamilyDataState state="empty" />;

  const sections = [
    ['兴趣', profile.interests],
    ['需要加强的学科', profile.weakSubjects],
    ['喜欢的运动', profile.sportsPreferences],
    ['艺术兴趣', profile.artInterests],
    ['劳动习惯', profile.laborHabits],
    ['品德目标', profile.moralGoals]
  ];

  return (
    <section className="child-page" aria-labelledby="child-profile-title">
      <div className="child-page-heading">
        <div>
          <p className="child-eyebrow">这是我的成长档案</p>
          <h1 id="child-profile-title">{profile.name}</h1>
          <p>{profile.grade == null ? '年级暂未填写' : `${profile.grade} 年级`}</p>
        </div>
      </div>

      <div className="child-profile-grid">
        {sections.map(([label, values]) => (
          <section className="child-profile-section" key={label}>
            <h2>{label}</h2>
            <ProfileValues values={values} />
          </section>
        ))}
      </div>

      <button type="button" className="child-secondary-button" onClick={handleLogout}>退出孩子端</button>
    </section>
  );
};

export default ChildProfilePage;
