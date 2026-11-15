import React from 'react';
import { Link } from 'react-router-dom';

export default function TutorSourceLink({ type, id, childId, subject }) {
  if (typeof subject !== 'string' || !['math', '数学'].includes(subject.trim().toLowerCase())) return null;
  const query = new URLSearchParams({ childId, sourceType: type, sourceId: id });
  return <Link className="family-button secondary" to={`/app/tutor?${query}`}>准备讲解</Link>;
}
