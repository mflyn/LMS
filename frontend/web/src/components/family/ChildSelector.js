import React from 'react';
import { useFamily } from '../../contexts/FamilyContext';

const ChildSelector = () => {
  const { children, selectedChildId, selectChild } = useFamily();

  return (
    <label className="family-child-selector" htmlFor="family-child-selector">
      <span>当前孩子</span>
      <select
        id="family-child-selector"
        aria-label="当前孩子"
        value={selectedChildId || ''}
        onChange={(event) => selectChild(event.target.value)}
        disabled={children.length === 0}
      >
        {children.length === 0 ? (
          <option value="">尚未添加孩子</option>
        ) : children.map((child) => (
          <option key={child.childId} value={child.childId}>{child.name}</option>
        ))}
      </select>
    </label>
  );
};

export default ChildSelector;
