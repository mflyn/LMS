const fs = require('fs');
const path = require('path');

const apiDocument = fs.readFileSync(
  path.resolve(__dirname, '../../../../docs/api/family-learning-tracker-api.md'),
  'utf8'
);

const section = (heading, nextHeading) => {
  const start = apiDocument.indexOf(heading);
  const end = apiDocument.indexOf(nextHeading, start);
  if (start < 0 || end < 0) throw new Error(`API section not found: ${heading}`);
  return apiDocument.slice(start, end);
};

const jsonBlocks = (markdown) => Array.from(
  markdown.matchAll(/```json\n([\s\S]*?)\n```/g),
  (match) => JSON.parse(match[1])
);

describe('family learning API examples', () => {
  test('TC-T5-CONTRACT-001 knowledge point update response reflects the requested mastery level', () => {
    const [request, response] = jsonBlocks(section(
      '### 5.3 更新知识点或能力点',
      '## 6. Mistakes'
    ));

    expect(response.data.knowledgePoint.masteryLevel).toBe(request.masteryLevel);
    expect(response.data.knowledgePoint.masteryLevel).toBe('skilled');
  });

  test('canonical family and child mutation names do not expose obsolete aliases', () => {
    const contract = section(
      '### 2.8 退出、家庭更新和孩子档案契约',
      '## 3. Growth Tasks'
    );

    const allowedChildFields = contract.match(
      /`PATCH \/api\/children\/:childId` 只允许家长修改[^。]+。/
    )[0];
    expect(contract).toContain('`familyName`');
    expect(allowedChildFields).toContain('`textbookVersion`');
    expect(allowedChildFields).toContain('`sportsPreferences`');
    expect(allowedChildFields).not.toContain('`curriculumVersion`');
    expect(allowedChildFields).not.toContain('`sportPreferences`');
  });

  test('notification example uses the stable reminder contract and canonical order', () => {
    const [response] = jsonBlocks(section(
      '### 10.1 查询家庭提醒',
      '### 10.2 查询和更新提醒设置'
    ));
    const [first] = response.data.items;

    expect(first).toEqual(expect.objectContaining({
      reminderId: expect.any(String),
      type: 'task_overdue',
      childId: expect.any(String),
      localDate: expect.any(String),
      sourceId: expect.any(String),
      severity: 'warning',
      title: expect.any(String),
      message: expect.any(String),
      dimension: 'academic'
    }));
  });
});
