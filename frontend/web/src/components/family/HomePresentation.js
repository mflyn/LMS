import React from 'react';
import { BookOutlined, BulbOutlined, HeartOutlined, SmileOutlined, TeamOutlined } from '@ant-design/icons';
import '../../home-pages.css';

const TASK_ICONS = { academic: BookOutlined, physical: HeartOutlined, moral: SmileOutlined, artistic: BulbOutlined, labor: TeamOutlined };
const STATUS_LABELS = { pending: '待完成', completed: '等待家长确认', confirmed: '已确认', cancelled: '已取消', archived: '已归档' };

export const HomeTaskIcon = ({ dimension }) => {
  const Icon = TASK_ICONS[dimension] || BookOutlined;
  return <span className={`home-task-icon is-${dimension || 'other'}`} aria-hidden="true"><Icon /></span>;
};

export const HomeTaskStatus = ({ status }) => (
  <span className={`home-task-status is-${status}`}>{STATUS_LABELS[status] || status}</span>
);
