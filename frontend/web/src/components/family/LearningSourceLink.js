import React from 'react';
import { Link } from 'react-router-dom';
import { isLearningId, mistakeUrl, taskUrl } from '../../services/learningSources';

// Only detail responses carry an authoritative source projection; lists never render one.
const LearningSourceLink = ({ item, role = 'parent' }) => {
  const sourceId = item?.sourceTaskId || item?.sourceMistakeId;
  if (!sourceId) return null;
  const source = item.source;
  if (item.sourceAvailable === false) return <p role="status">来源不可用</p>;
  if (item.sourceAvailable !== true || !isLearningId(sourceId) || source?.id !== sourceId
    || source.familyId !== item.familyId || source.childId !== item.childId) return null;
  return <Link className={role === 'student' ? 'child-back-link' : 'family-button secondary'}
    to={item.sourceTaskId ? taskUrl(role, sourceId) : mistakeUrl(role, sourceId)}>
    查看来源{item.sourceTaskId ? '任务' : '错题'}{source.title ? `：${source.title}` : ''}
  </Link>;
};
export default LearningSourceLink;
