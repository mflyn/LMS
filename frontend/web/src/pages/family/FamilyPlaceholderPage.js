import React from 'react';
import { useFamily } from '../../contexts/FamilyContext';
import FamilyPageState from '../../components/family/FamilyPageState';

const FamilyPlaceholderPage = ({ title, description }) => {
  const { selectedChild } = useFamily();

  return (
    <section className="family-page" aria-labelledby={`${title}-page-title`}>
      <p className="family-eyebrow">家庭成长</p>
      <h1 id={`${title}-page-title`}>{title}</h1>
      {selectedChild ? (
        <p>{description} 当前孩子：{selectedChild.name}。</p>
      ) : <FamilyPageState state="empty" />}
    </section>
  );
};

export default FamilyPlaceholderPage;
