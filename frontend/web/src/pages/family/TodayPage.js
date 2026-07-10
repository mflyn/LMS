import React from 'react';
import { useFamily } from '../../contexts/FamilyContext';
import FamilyPageState from '../../components/family/FamilyPageState';

const TodayPage = () => {
  const { selectedChild } = useFamily();

  return (
    <section className="family-page" aria-labelledby="today-page-title">
      <p className="family-eyebrow">家庭概览</p>
      <h1 id="today-page-title">今日成长</h1>
      {selectedChild ? (
        <p>正在为 {selectedChild.name} 准备今天的成长记录。</p>
      ) : <FamilyPageState state="empty" />}
    </section>
  );
};

export default TodayPage;
