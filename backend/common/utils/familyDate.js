const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isValidTimeZone = (timeZone) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format();
    return true;
  } catch (error) {
    return false;
  }
};

const formatLocalDate = (date, timeZone) => {
  if (!isValidTimeZone(timeZone)) throw new Error('Invalid IANA timezone');
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date).reduce((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const assertLocalDate = (localDate) => {
  if (!LOCAL_DATE_PATTERN.test(localDate)) throw new Error('Invalid LocalDate');
  const [year, month, day] = localDate.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new Error('Invalid LocalDate');
  }
  return parsed;
};

const addLocalDateDays = (localDate, days) => {
  const parsed = assertLocalDate(localDate);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
};

const getWeekRange = (localDate) => {
  const parsed = assertLocalDate(localDate);
  const mondayOffset = parsed.getUTCDay() === 0 ? -6 : 1 - parsed.getUTCDay();
  const start = addLocalDateDays(localDate, mondayOffset);
  return { start, end: addLocalDateDays(start, 6) };
};

module.exports = {
  LOCAL_DATE_PATTERN,
  addLocalDateDays,
  formatLocalDate,
  getWeekRange,
  isValidTimeZone
};
