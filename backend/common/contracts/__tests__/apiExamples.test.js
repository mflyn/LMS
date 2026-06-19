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
});
