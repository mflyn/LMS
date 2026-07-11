import React, { useCallback, useEffect, useState } from 'react';
import FamilyDataState from '../../components/family/FamilyDataState';
import { useFamily } from '../../contexts/FamilyContext';
import { useChildResource } from '../../hooks/useChildResource';
import {
  getNotificationSettings,
  listFamilyReminders,
  updateNotificationSettings
} from '../../services/familyApi';

const SWITCHES = [
  ['taskReminderEnabled', '任务到期提醒'],
  ['overdueReminderEnabled', '任务逾期提醒'],
  ['mistakeReviewReminderEnabled', '错题复习提醒'],
  ['dimensionReminderEnabled', '五育均衡提醒'],
  ['weeklyReportReminderEnabled', '周报提醒']
];
const messageFor = (error) => error?.response?.data?.error?.message || error?.message || '保存失败，请重试。';

const RemindersPage = () => {
  const { selectedChild } = useFamily();
  const loadReminders = useCallback(async ({ childId, signal }) => {
    const result = await listFamilyReminders({ childId }, signal);
    return {
      data: result,
      partial: Boolean(result.meta?.partial),
      unavailableSources: result.meta?.unavailableSources || []
    };
  }, []);
  const loadSettings = useCallback(({ signal }) => getNotificationSettings(signal), []);
  const reminders = useChildResource({ load: loadReminders });
  const settingsResource = useChildResource({ load: loadSettings });
  const [settings, setSettings] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (settingsResource.data?.settings) setSettings(settingsResource.data.settings);
  }, [settingsResource.data]);

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const payload = SWITCHES.reduce((value, [field]) => ({ ...value, [field]: settings[field] }), {
      weeklyReportDay: Number(settings.weeklyReportDay),
      quietHours: { start: settings.quietHours.start, end: settings.quietHours.end }
    });
    try {
      const result = await updateNotificationSettings(payload);
      setSettings(result.settings);
      setMessage('提醒设置已保存。');
    } catch (saveError) {
      setError(messageFor(saveError));
    } finally {
      setBusy(false);
    }
  };

  if (!selectedChild) return <FamilyDataState state="empty" />;
  const items = reminders.data?.items || [];

  return (
    <section className="family-page family-page-wide" aria-labelledby="reminders-page-title">
      <div className="family-page-heading"><div><p className="family-eyebrow">{selectedChild.name}的今日关注</p><h1 id="reminders-page-title">提醒</h1></div></div>
      {reminders.state === 'loading' && <FamilyDataState state="loading" />}
      {reminders.state === 'retryable_error' && <FamilyDataState state="retryable_error" onRetry={reminders.reload} />}
      {reminders.state === 'error' && <FamilyDataState state="error" error={reminders.error} />}
      {reminders.state === 'partial' && <FamilyDataState state="partial" unavailableSources={reminders.unavailableSources} />}
      {reminders.data && items.length === 0 && <p className="family-empty-copy">今天暂无提醒</p>}
      <div className="family-record-list">{items.map((item, index) => <article className="family-record" key={item.sourceId || `${item.type}-${index}`}><div className="family-record-main"><h2>{item.title}</h2><p>{item.dueDate || item.type}</p></div></article>)}</div>
      {settingsResource.state === 'loading' && <FamilyDataState state="loading" />}
      {settingsResource.state === 'retryable_error' && <FamilyDataState state="retryable_error" onRetry={settingsResource.reload} />}
      {settingsResource.state === 'error' && <FamilyDataState state="error" error={settingsResource.error} />}
      {settings && (
        <form className="family-panel family-settings-form" onSubmit={save}>
          <h2>提醒设置</h2>
          <div className="family-checkbox-row">{SWITCHES.map(([field, label]) => <label className="family-checkbox" key={field}><input type="checkbox" checked={settings[field]} onChange={(event) => setSettings((value) => ({ ...value, [field]: event.target.checked }))} />{label}</label>)}</div>
          <div className="family-form-grid">
            <label>周报提醒日<select value={settings.weeklyReportDay} onChange={(event) => setSettings((value) => ({ ...value, weeklyReportDay: Number(event.target.value) }))}>{['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select></label>
            <label>免打扰开始<input type="time" required value={settings.quietHours.start} onChange={(event) => setSettings((value) => ({ ...value, quietHours: { ...value.quietHours, start: event.target.value } }))} /></label>
            <label>免打扰结束<input type="time" required value={settings.quietHours.end} onChange={(event) => setSettings((value) => ({ ...value, quietHours: { ...value.quietHours, end: event.target.value } }))} /></label>
          </div>
          {error && <p className="family-form-error" role="alert">{error}</p>}
          {message && <p className="family-success-message" role="status">{message}</p>}
          <button type="submit" className="family-button primary" disabled={busy}>保存提醒设置</button>
        </form>
      )}
    </section>
  );
};

export default RemindersPage;
