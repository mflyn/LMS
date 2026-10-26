#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { createHash } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const Ajv2020 = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const { canonicalize } = require('json-canonicalize');

const repositoryRoot = path.resolve(__dirname, '..');
const authoritativeDocuments = [
  'README.md',
  'docs/README.md',
  'docs/development/README.md',
  'docs/product/family-learning-tracker.md',
  'docs/architecture/family-learning-tracker-architecture.md',
  'docs/architecture/sequence-diagrams.md',
  'docs/architecture/decisions/0008-co-parent-membership-governance.md',
  'docs/api/family-learning-tracker-api.md',
  'docs/development/family-growth-requirement-traceability.md',
  'docs/development/family-growth-design-asset-index.md',
  'docs/development/family-growth-baseline-v1.6-manifest.md',
  'docs/development/family-growth-v1.6-release-gate.md',
  'docs/development/family-growth-mistake-pdf-multi-attachments-gate.md',
  'docs/superpowers/specs/2026-07-16-family-growth-task12-co-parent-design.md',
  'docs/development/family-growth-task12-test-cases.md',
  'docs/development/family-growth-task12-design-review.md',
  'docs/development/family-growth-task12-gate.md',
  'docs/deployment/README.md',
  'docs/deployment/local-ubuntu-deployment.md',
  'docs/user-guide/README.md',
  'docs/user-guide/quick-start.md',
  'docs/user-guide/parent-guide.md',
  'docs/user-guide/child-guide.md'
];

const proposedAiDocuments = [
  'docs/architecture/family-ai-learning-platform-design.md',
  'docs/ThinkPad_DeepTutor_K12_部署手册/00_总目录与实施路线.md',
  'docs/ThinkPad_DeepTutor_K12_部署手册/01_功能硬件与系统架构.md',
  'docs/ThinkPad_DeepTutor_K12_部署手册/02_Ubuntu_Docker_DeepTutor安装.md',
  'docs/ThinkPad_DeepTutor_K12_部署手册/03_DeepSeek与Embedding配置.md',
  'docs/ThinkPad_DeepTutor_K12_部署手册/04_K12数据部署及教材扩展.md',
  'docs/ThinkPad_DeepTutor_K12_部署手册/05_DeepTutor与K12集成设计.md',
  'docs/ThinkPad_DeepTutor_K12_部署手册/06_运维备份迁移安全许可证.md'
];

const proposedSelfDirectedDocuments = [
  'docs/research/family-self-directed-learning-theory-and-program.md',
  'docs/architecture/family-self-directed-learning-system-design.md',
  'docs/superpowers/plans/2026-10-21-family-self-directed-learning-mvp.md',
  'docs/development/family-self-directed-learning-mvp-gate.md'
];
const selfDirectedContractProbes = 16;

const proposedAiContracts = [
  'docs/contracts/curriculum-ref.schema.json',
  'docs/contracts/curriculum-ref-snapshot.schema.json',
  'docs/contracts/error-classification.schema.json',
  'docs/contracts/tutor-generation-input.schema.json',
  'docs/contracts/explanation-content.schema.json',
  'docs/contracts/practice-content.schema.json',
  'docs/contracts/tutor-artifact.schema.json',
  'docs/contracts/tutor-cycle-attempt.schema.json',
  'docs/contracts/tutor-artifact-review-request.schema.json',
  'docs/contracts/tutor-correction-review-request.schema.json',
  'docs/contracts/tutor-cycle-create-request.schema.json',
  'docs/contracts/tutor-generation-job-request.schema.json',
  'docs/contracts/tutor-stage-action-request.schema.json',
  'docs/contracts/tutor-stage-submission-request.schema.json',
  'docs/contracts/tutor-cycle-state-machine.json',
  'docs/contracts/tutor-learning-cycle.schema.json',
  'docs/contracts/tutor-final-review-request.schema.json',
  'docs/contracts/tutor-final-review-snapshot.schema.json',
  'docs/contracts/tutor-idempotency-record.schema.json',
  'docs/contracts/tutor-finalization-command.schema.json',
  'docs/contracts/mastery-evidence-command-payload.schema.json',
  'docs/contracts/mistake-review-command-payload.schema.json'
];

const contractFixtureDirectory = 'docs/contracts/fixtures';

const tutorMutationSemantics = new Map([
  ['cycle-create', { allowedActorRoles: ['parent'], responseVariants: [{ when: {}, httpStatus: 200, responseResourceType: 'TutorLearningCycle' }] }],
  ['explanation-job', { allowedActorRoles: ['parent'], responseVariants: [{ when: {}, httpStatus: 202, responseResourceType: 'TutorGenerationJob' }] }],
  ['explanation-artifact-review', { allowedActorRoles: ['parent'], responseVariants: [{ when: {}, httpStatus: 200, responseResourceType: 'TutorArtifact' }] }],
  ['correction-start', { allowedActorRoles: ['parent', 'child'], responseVariants: [{ when: {}, httpStatus: 200, responseResourceType: 'TutorLearningCycle' }] }],
  ['correction-submit', { allowedActorRoles: ['parent', 'child'], responseVariants: [{ when: {}, httpStatus: 200, responseResourceType: 'TutorCycleAttempt' }] }],
  ['correction-review', { allowedActorRoles: ['parent'], responseVariants: [{ when: {}, httpStatus: 200, responseResourceType: 'TutorCycleAttempt' }] }],
  ['practice-job', { allowedActorRoles: ['parent'], responseVariants: [{ when: {}, httpStatus: 202, responseResourceType: 'TutorGenerationJob' }] }],
  ['practice-artifact-review', { allowedActorRoles: ['parent'], responseVariants: [{ when: {}, httpStatus: 200, responseResourceType: 'TutorArtifact' }] }],
  ['practice-start', { allowedActorRoles: ['parent', 'child'], responseVariants: [{ when: {}, httpStatus: 200, responseResourceType: 'TutorLearningCycle' }] }],
  ['practice-submit', { allowedActorRoles: ['parent', 'child'], responseVariants: [{ when: {}, httpStatus: 200, responseResourceType: 'TutorCycleAttempt' }] }],
  ['final-review', { allowedActorRoles: ['parent'], responseVariants: [
    { when: { decision: 'revise' }, httpStatus: 200, responseResourceType: 'TutorCycleAttempt' },
    { when: { decision: 'mastered' }, httpStatus: 202, responseResourceType: 'TutorFinalReview' }
  ] }],
  ['cycle-cancel', { allowedActorRoles: ['parent'], responseVariants: [{ when: {}, httpStatus: 200, responseResourceType: 'TutorLearningCycle' }] }]
]);

function resolveTutorResponseVariant(mutationSemantics, request) {
  if (!mutationSemantics || !request || Array.isArray(request)) {
    return null;
  }
  const matches = mutationSemantics.responseVariants.filter(variant =>
    Object.entries(variant.when).every(([field, expected]) => request[field] === expected)
  );
  return matches.length === 1 ? matches[0] : null;
}

function matchesTutorResponseVariant(responseReference, variant) {
  return Boolean(variant) &&
    responseReference?.httpStatus === variant.httpStatus &&
    responseReference?.resourceType === variant.responseResourceType;
}

function matchesAnyTutorResponseVariant(responseReference, mutationSemantics) {
  return Boolean(mutationSemantics) && mutationSemantics.responseVariants.some(
    variant => matchesTutorResponseVariant(responseReference, variant)
  );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function read(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
}

function requirementIds(markdown) {
  return new Set(
    [...markdown.matchAll(/^\|\s*`((?:FR|NFR)-[A-Z]+-\d{3})`\s*\|/gm)].map(
      match => match[1]
    )
  );
}

function assert(condition, message, errors) {
  if (!condition) {
    errors.push(message);
  }
}

function sameSet(actual, expected) {
  return (
    actual.size === expected.size && [...actual].every(value => expected.has(value))
  );
}

function boundedSection(markdown, startMarker, endMarker) {
  const start = markdown.indexOf(startMarker);
  const end = markdown.indexOf(endMarker, start + startMarker.length);
  return start >= 0 && end > start ? markdown.slice(start, end) : '';
}

const stableMediaContractMarkers = Object.freeze([
  '稳定业务拒绝',
  '不得递增 `completionVersion`',
  '新的 `operationId`',
  '仅首次进程内 prepare',
  '恢复执行不得凭后来收到的稳定 4xx',
  '清除 pending 意图',
  '受控引用状态对账',
  '最小规范业务 patch',
  '新增集合',
  '保留集合',
  '移除集合',
  '不发送空媒体命令',
  '不可变成功响应投影',
  '`successResponse`',
  '每个任务最多一个活动完成命令',
  '`activeCompletionOperation`',
  '`PUBLISHED_CLEANUP`',
  '发布后不得回滚已发布作品',
  '新增集合为空时不进行全称状态判断',
  '移除集合全部收敛后',
  '`MediaReferenceOperation`',
  'absent 不能作为失败终态证据',
  '终止与提交必须竞争同一 operation 记录',
  '租约过期原子转为 ABORTED',
  '终态记录不做 TTL 删除',
  'commandHash',
  '`remoteOperationId`',
  '远程标识与首次命令占位同事务持久化',
  '内部 operationId 必须取持久化 remoteOperationId',
  'remoteOperationId 唯一索引',
  '不同 actor 使用同一 UUID 必须分配不同远程标识'
]);

function stableMediaContractErrors(section) {
  const errors = stableMediaContractMarkers
    .filter(marker => !section.includes(marker))
    .map(marker => `missing ${marker}`);
  if (/稳定业务拒绝[\s\S]{0,600}保留 pending 意图/.test(section)) {
    errors.push('stable rejection must not retain the pending intent');
  }
  return errors;
}

const helpReplayContractMarkers = Object.freeze([
  '安全重放必须同时满足',
  '`currentHelpVersion === expectedHelpVersion + 1`',
  '规范化后的 `helpType + note` 完全相同',
  '认证 actor 与 `requestedByActor` 相同',
  '旧版本 resolve 返回 `409 VERSION_CONFLICT`'
]);

function helpReplayContractErrors(section) {
  return helpReplayContractMarkers
    .filter(marker => !section.includes(marker))
    .map(marker => `missing ${marker}`);
}

function completionEvidenceContractErrors(model) {
  return ['helpType', 'supportLevelUsed']
    .filter(field => model.includes(field))
    .map(field => `completionEvidence must not contain ${field}`);
}

const checklistInitializationMarkers = Object.freeze([
  '未提供或显式提供空清单',
  '`checklistVersion=0`',
  '提供非空有效清单',
  '`checklistVersion=1`'
]);

function checklistInitializationErrors(section) {
  return checklistInitializationMarkers
    .filter(marker => !section.includes(marker))
    .map(marker => `missing ${marker}`);
}

const valueGateTextRules = [
  ['evidence', '复用已有作品、口述、订正或延迟再练习'],
  ['evidence', '同一孩子、可比学习目标/内容、难度、支持程度和回忆间隔'],
  ['evidence', '至少两次不同日期的正式观察，与基线中可比的学习证据对照'],
  ['evidence', '难度或支持变化无法解释时标为不可比'],
  ['evidence', '不强制新增考试、刷题、成绩总分、排名或后台采集'],
  ['decision', '按以下顺序判定，首个命中即停止：FAIL → PARTIAL → PASS，否则 PARTIAL'],
  ['decision', '安全/身心停止条件和未解决的负向证据优先于主动性积极例子'],
  ['pass', '足够且可解释的可比学习证据，未见明显、未解决的学习效果下降'],
  ['pass', '全部前提同时满足且未命中 FAIL/PARTIAL'],
  ['partial', '缺少可比学习证据、结果不确定或成人代办无法区分'],
  ['partial', '已观察到的学习下降尚未解决或调整后复核不足'],
  ['fail', '安全暂停仍未解决'],
  ['fail', '持续且未解决的冲突、疲劳、睡眠/运动挤占、屏幕依赖'],
  ['fail', '核心流程阻碍家庭且调整后仍不能使用'],
  ['decision', '证据缺失不能视为“没有下降”，也不能据此判孩子退步或 FAIL'],
  ['decision', '调整支架、任务难度或负担，约定下一次自然学习机会复核'],
  ['decision', '学习下降本身不自动判 FAIL'],
  ['decision', '调整后持续不可用或命中原安全/身心停止条件才判 FAIL'],
  ['decision', '若调整后已有至少两次不同日期的可比复核证据表明负向问题已解决，且全部其他前提满足，才可重新判 PASS；']
];

const valueGateExamples = [
  ['TC-SL-VALUE-007', '主动性改善但学习下降', 'PARTIAL'],
  ['TC-SL-VALUE-008', '无可比学习证据', 'PARTIAL'],
  ['TC-SL-VALUE-009', '难度或支持变化导致不可比', 'PARTIAL'],
  ['TC-SL-VALUE-010', '学习效果稳定且适龄主动性证据充分', 'PASS'],
  ['TC-SL-VALUE-011', '工程成功但家庭证据缺失', 'PARTIAL'],
  ['TC-SL-VALUE-012', '睡眠/冲突停止条件优先', 'FAIL'],
  ['TC-SL-VALUE-013', '成人代办无法区分', 'PARTIAL'],
  ['TC-SL-VALUE-014', '下降调整后仍持续不可用', 'FAIL'],
  ['TC-SL-VALUE-015', '下降已解决且可比复核充分', 'PASS']
];

function valueGateSections(markdown) {
  const body = boundedSection(markdown, '## 14. T9 轻量价值验收规程', '## 15. R1–R8');
  const evidence = boundedSection(body, '### 14.1 基线与最少证据', '### 14.2 判定、停止与缺失');
  const decision = boundedSection(body, '### 14.2 判定、停止与缺失', '### 14.3 合成判定反例');
  const examplesStart = body.indexOf('### 14.3 合成判定反例');
  const examples = examplesStart >= 0 ? body.slice(examplesStart) : '';
  const definitions = Object.fromEntries(['PASS', 'PARTIAL', 'FAIL'].map(label => [
    label, decision.split('\n').filter(line => new RegExp(`^\\|\\s*${label}\\s*\\|`).test(line))
  ]));
  const row = label => definitions[label].length === 1 ? definitions[label][0] : '';
  return { evidence, decision, examples, definitions, pass: row('PASS'), partial: row('PARTIAL'), fail: row('FAIL') };
}

function valueGateContractErrors(markdown) {
  const sections = valueGateSections(markdown);
  const errors = valueGateTextRules
    .filter(([section, marker]) => !sections[section].includes(marker))
    .map(([section, marker]) => `missing ${section} clause: ${marker}`);
  for (const [label, definitions] of Object.entries(sections.definitions)) {
    if (definitions.length !== 1) {
      errors.push(`decision section must contain exactly one ${label} definition`);
      continue;
    }
    const cells = definitions[0].split('|').slice(1, -1).map(cell => cell.trim());
    if (cells.length !== 2 || !cells[1]) {
      errors.push(`invalid ${label} definition row`);
    }
  }
  // These are documentation fixtures, not an evaluator of real children's learning.
  const rows = sections.examples.split('\n').filter(line => line.startsWith('| TC-SL-VALUE-'))
    .map(line => line.split('|').slice(1, -1).map(cell => cell.trim()));
  for (const [id, scenario, expected] of valueGateExamples) {
    const matches = rows.filter(row => row[0] === id);
    if (matches.length !== 1 || matches[0].length !== 4 ||
        !matches[0][1].includes(scenario) || matches[0][2] !== expected || !matches[0][3]) {
      errors.push(`invalid synthetic example ${id}: expected ${expected}`);
    }
  }
  return errors;
}

const headingCache = new Map();

function headingSlug(text) {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

function headingSlugs(absolutePath) {
  if (headingCache.has(absolutePath)) {
    return headingCache.get(absolutePath);
  }
  const seen = new Map();
  const slugs = new Set();
  const markdown = fs.readFileSync(absolutePath, 'utf8');
  for (const match of markdown.matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)) {
    let slug = headingSlug(match[1]);
    const duplicateCount = seen.get(slug) || 0;
    seen.set(slug, duplicateCount + 1);
    if (duplicateCount > 0) {
      slug = `${slug}-${duplicateCount}`;
    }
    slugs.add(slug);
  }
  headingCache.set(absolutePath, slugs);
  return slugs;
}

function checkLocalLinks(relativePath, markdown, errors) {
  const linkPattern = /!?\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of markdown.matchAll(linkPattern)) {
    let target = match[1].trim();
    if (target.startsWith('<') && target.endsWith('>')) {
      target = target.slice(1, -1);
    }
    if (/^(?:https?:|mailto:|tel:)/i.test(target)) {
      continue;
    }
    const [targetPath, fragment] = target.split('#');
    const decodedTarget = decodeURIComponent(targetPath || path.basename(relativePath));
    const resolved = path.resolve(
      repositoryRoot,
      path.dirname(relativePath),
      decodedTarget
    );
    assert(
      fs.existsSync(resolved),
      `${relativePath}: missing local link target ${decodedTarget}`,
      errors
    );
    if (
      fragment &&
      fs.existsSync(resolved) &&
      fs.statSync(resolved).isFile() &&
      path.extname(resolved).toLowerCase() === '.md'
    ) {
      const decodedFragment = decodeURIComponent(fragment).toLowerCase();
      assert(
        headingSlugs(resolved).has(decodedFragment),
        `${relativePath}: missing heading ${decodedTarget}#${decodedFragment}`,
        errors
      );
    }
  }
}

function scanFencedBlocks(markdown) {
  const blocks = [];
  const lines = markdown.split(/\r?\n/);
  let openFence = null;

  for (const line of lines) {
    if (!openFence) {
      const match = line.match(/^( {0,3})(`{3,}|~{3,})[ \t]*([^\s`~]*)[^\r\n]*$/);
      if (!match) {
        continue;
      }
      openFence = {
        marker: match[2][0],
        length: match[2].length,
        language: match[3].toLowerCase(),
        lines: []
      };
      continue;
    }

    const closing = line.match(/^( {0,3})(`{3,}|~{3,})[ \t]*$/);
    if (
      closing &&
      closing[2][0] === openFence.marker &&
      closing[2].length >= openFence.length
    ) {
      blocks.push({
        language: openFence.language,
        content: openFence.lines.join('\n').trim()
      });
      openFence = null;
      continue;
    }
    openFence.lines.push(line);
  }

  return { blocks, unclosed: openFence !== null };
}

function fencedBlocks(markdown, language) {
  return scanFencedBlocks(markdown).blocks
    .filter(block => block.language === language)
    .map(block => block.content);
}

function duplicateJsonKeys(source) {
  let cursor = 0;
  const duplicates = [];

  const skipWhitespace = () => {
    while (/\s/.test(source[cursor] || '')) {
      cursor += 1;
    }
  };

  const parseString = () => {
    const start = cursor;
    cursor += 1;
    while (cursor < source.length) {
      if (source[cursor] === '\\') {
        cursor += 2;
        continue;
      }
      if (source[cursor] === '"') {
        cursor += 1;
        return JSON.parse(source.slice(start, cursor));
      }
      cursor += 1;
    }
    throw new Error('unterminated JSON string');
  };

  const expect = expected => {
    skipWhitespace();
    if (source[cursor] !== expected) {
      throw new Error(`expected ${expected} at offset ${cursor}`);
    }
    cursor += 1;
  };

  const parseValue = pathParts => {
    skipWhitespace();
    if (source[cursor] === '{') {
      parseObject(pathParts);
      return;
    }
    if (source[cursor] === '[') {
      parseArray(pathParts);
      return;
    }
    if (source[cursor] === '"') {
      parseString();
      return;
    }
    while (cursor < source.length && !/[\s,\]}]/.test(source[cursor])) {
      cursor += 1;
    }
  };

  const parseObject = pathParts => {
    expect('{');
    const keys = new Set();
    skipWhitespace();
    if (source[cursor] === '}') {
      cursor += 1;
      return;
    }
    while (cursor < source.length) {
      skipWhitespace();
      const key = parseString();
      if (keys.has(key)) {
        duplicates.push([...pathParts, key].join('.'));
      }
      keys.add(key);
      expect(':');
      parseValue([...pathParts, key]);
      skipWhitespace();
      if (source[cursor] === '}') {
        cursor += 1;
        return;
      }
      expect(',');
    }
  };

  const parseArray = pathParts => {
    expect('[');
    let index = 0;
    skipWhitespace();
    if (source[cursor] === ']') {
      cursor += 1;
      return;
    }
    while (cursor < source.length) {
      parseValue([...pathParts, String(index)]);
      index += 1;
      skipWhitespace();
      if (source[cursor] === ']') {
        cursor += 1;
        return;
      }
      expect(',');
    }
  };

  parseValue([]);
  return duplicates;
}

function checkMarkdownStructure(relativePath, markdown, errors) {
  const scan = scanFencedBlocks(markdown);
  assert(
    !scan.unclosed,
    `${relativePath}: unclosed fenced code block`,
    errors
  );

  const jsonBlocks = scan.blocks.filter(block => block.language === 'json');
  for (const [index, { content: block }] of jsonBlocks.entries()) {
    try {
      JSON.parse(block);
      const duplicateKeys = duplicateJsonKeys(block);
      assert(
        duplicateKeys.length === 0,
        `${relativePath}: JSON example ${index + 1} contains duplicate keys: ${duplicateKeys.join(', ')}`,
        errors
      );
    } catch (error) {
      errors.push(`${relativePath}: JSON example ${index + 1} is invalid: ${error.message}`);
    }
  }

  const mermaidBlocks = scan.blocks.filter(block => block.language === 'mermaid');
  for (const [index, { content: block }] of mermaidBlocks.entries()) {
    assert(
      /^(?:flowchart|sequenceDiagram|stateDiagram-v2|erDiagram)\b/.test(block),
      `${relativePath}: Mermaid block ${index + 1} has an unsupported or missing diagram header`,
      errors
    );
  }
}

function loadJson(relativePath, errors) {
  const absolutePath = path.join(repositoryRoot, relativePath);
  assert(fs.existsSync(absolutePath), `${relativePath}: file is missing`, errors);
  if (!fs.existsSync(absolutePath)) {
    return {};
  }
  try {
    return JSON.parse(read(relativePath));
  } catch (error) {
    errors.push(`${relativePath}: invalid JSON: ${error.message}`);
    return {};
  }
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function applyFixtureSet(base, values) {
  const result = cloneJson(base);
  for (const [dotPath, value] of Object.entries(values || {})) {
    const parts = dotPath.split('.');
    let cursor = result;
    for (const part of parts.slice(0, -1)) {
      if (
        !Object.hasOwn(cursor, part) ||
        cursor[part] === null ||
        typeof cursor[part] !== 'object'
      ) {
        cursor[part] = {};
      }
      cursor = cursor[part];
    }
    const finalPart = parts.at(-1);
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof value.$repeat === 'string' &&
      Number.isInteger(value.$count) &&
      value.$count >= 0 &&
      sameSet(new Set(Object.keys(value)), new Set(['$repeat', '$count']))
    ) {
      cursor[finalPart] = value.$repeat.repeat(value.$count);
    } else if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value).length === 1 &&
      value.$delete === true
    ) {
      delete cursor[finalPart];
    } else {
      cursor[finalPart] = cloneJson(value);
    }
  }
  return result;
}

const finalReviewHashFields = [
  'schemaVersion',
  'finalReviewId',
  'finalReviewVersion',
  'cycleId',
  'familyId',
  'childId',
  'sourceMistakeId',
  'knowledgePointId',
  'practiceAttemptId',
  'practiceAttemptVersion',
  'practiceReviewOperationId',
  'decision',
  'evidenceSummary',
  'reviewedByParentId',
  'reviewedAt'
];

function sha256JsonArray(values) {
  return `sha256:${createHash('sha256')
    .update(JSON.stringify(values), 'utf8')
    .digest('hex')}`;
}

function sha256CanonicalJson(value) {
  return `sha256:${createHash('sha256')
    .update(canonicalize(value), 'utf8')
    .digest('hex')}`;
}

function computeContentHash(content) {
  return sha256CanonicalJson(content);
}

function computeFinalReviewHash(snapshot) {
  return sha256JsonArray(finalReviewHashFields.map(field => snapshot?.[field]));
}

function computePayloadHash(payload) {
  return sha256JsonArray([
    payload?.schemaVersion,
    payload?.finalReview?.finalReviewHash
  ]);
}

function computeRequestPayloadHash(endpointOperation, resource, request) {
  const {
    operationId: _operationId,
    schemaVersion,
    ...normalizedRequestFields
  } = request || {};
  return sha256CanonicalJson({
    schemaVersion,
    endpointOperation,
    resource,
    request: normalizedRequestFields
  });
}

function computeGenerationRequestHash(generationInput) {
  return sha256CanonicalJson(generationInput);
}

function computeTutorResponseId(record) {
  return sha256CanonicalJson({
    schemaVersion: 'tutor-idempotency-response-v1',
    familyId: record?.familyId,
    childId: record?.childId,
    endpointOperation: record?.endpointOperation,
    operationId: record?.operationId,
    resource: { cycleId: record?.resource?.cycleId },
    httpStatus: record?.responseReference?.httpStatus,
    resourceType: record?.responseReference?.resourceType,
    resourceId: record?.responseReference?.resourceId
  });
}

const cycleProjectionFieldGroups = {
  explanation: [
    'explanationArtifactId',
    'explanationArtifactVersion',
    'explanationContentHash'
  ],
  correctionAttempt: [
    'currentCorrectionAttemptId',
    'currentCorrectionAttemptVersion'
  ],
  practice: ['practiceArtifactId', 'practiceArtifactVersion', 'practiceContentHash'],
  practiceAttempt: ['currentPracticeAttemptId', 'currentPracticeAttemptVersion']
};

function cancelledCycleProjectionErrors(value) {
  const errors = [];
  const status = value.cancelledFromStatus;
  const hasAny = fields => fields.some(field => value[field] !== undefined);
  const hasAll = fields => fields.every(field => value[field] !== undefined);
  const requireGroup = (name, statuses) => {
    if (statuses.includes(status) && !hasAll(cycleProjectionFieldGroups[name])) {
      errors.push(`cancelled cycle from ${status} must retain complete ${name} projection`);
    }
  };
  const forbidGroup = (name, statuses) => {
    if (statuses.includes(status) && hasAny(cycleProjectionFieldGroups[name])) {
      errors.push(`cancelled cycle from ${status} must not contain future ${name} projection`);
    }
  };

  const preExplanation = [
    'draft',
    'explanation_generation_failed',
    'explanation_pending_review',
    'explanation_rejected'
  ];
  const explanationOnly = ['explanation_approved'];
  const correctionInProgress = ['correction_in_progress'];
  const correctionCompleteBeforePractice = [
    'correction_submitted',
    'correction_needs_revision',
    'correction_approved',
    'practice_generation_failed',
    'practice_pending_review',
    'practice_rejected'
  ];
  const practiceBeforeSubmission = ['practice_approved'];
  const practiceInProgress = ['practice_in_progress'];
  const practiceSubmitted = ['practice_submitted', 'practice_needs_revision'];
  const afterExplanation = [
    ...explanationOnly,
    ...correctionInProgress,
    ...correctionCompleteBeforePractice,
    ...practiceBeforeSubmission,
    ...practiceInProgress,
    ...practiceSubmitted
  ];
  const afterCorrectionSubmission = [
    ...correctionCompleteBeforePractice,
    ...practiceBeforeSubmission,
    ...practiceInProgress,
    ...practiceSubmitted
  ];
  const afterPracticeApproval = [
    ...practiceBeforeSubmission,
    ...practiceInProgress,
    ...practiceSubmitted
  ];

  forbidGroup('explanation', preExplanation);
  forbidGroup('correctionAttempt', [...preExplanation, ...explanationOnly]);
  forbidGroup('practice', [
    ...preExplanation,
    ...explanationOnly,
    ...correctionInProgress,
    ...correctionCompleteBeforePractice
  ]);
  forbidGroup('practiceAttempt', [
    ...preExplanation,
    ...explanationOnly,
    ...correctionInProgress,
    ...correctionCompleteBeforePractice,
    ...practiceBeforeSubmission
  ]);
  requireGroup('explanation', afterExplanation);
  requireGroup('correctionAttempt', afterCorrectionSubmission);
  requireGroup('practice', afterPracticeApproval);
  requireGroup('practiceAttempt', practiceSubmitted);

  return errors;
}

function customContractErrors(schemaId, value) {
  const errors = [];

  if (
    schemaId.endsWith('/error-classification-v1.json') &&
    value.primaryReasonCode !== null &&
    value.secondaryReasonCodes?.includes(value.primaryReasonCode)
  ) {
    errors.push('primaryReasonCode must not also appear in secondaryReasonCodes');
  }

  const validatePracticeContent = practice => {
    if (!practice || practice.schemaVersion !== 'practice-v1') {
      return;
    }
    const exercises = Array.isArray(practice.exercises) ? practice.exercises : [];
    const policy = practice.generationPolicy || {};
    if (policy.exerciseCount !== exercises.length) {
      errors.push('generationPolicy.exerciseCount must equal exercises.length');
    }
    if (
      Array.isArray(policy.difficultySequence) &&
      policy.difficultySequence.length !== exercises.length
    ) {
      errors.push('difficultySequence length must equal exercises.length');
    }
    for (const [index, exercise] of exercises.entries()) {
      if (
        Array.isArray(policy.difficultySequence) &&
        policy.difficultySequence[index] !== exercise.difficulty
      ) {
        errors.push(`difficultySequence[${index}] must equal exercises[${index}].difficulty`);
      }
    }
    const exerciseIds = exercises.map(exercise => exercise.exerciseId);
    if (new Set(exerciseIds).size !== exerciseIds.length) {
      errors.push('exerciseId values must be unique inside one practice artifact');
    }
  };

  if (schemaId.endsWith('/practice-content-v1.json')) {
    validatePracticeContent(value);
  }

  if (schemaId.endsWith('/tutor-generation-input-v1.json')) {
    const classification = value.confirmedErrorClassification || {};
    if (classification.secondaryReasonCodes?.includes(classification.primaryReasonCode)) {
      errors.push('generation input primaryReasonCode must not repeat in secondaryReasonCodes');
    }
    const policy = value.generationPolicy || {};
    if (
      value.kind === 'practice' &&
      Array.isArray(policy.difficultySequence) &&
      policy.exerciseCount !== policy.difficultySequence.length
    ) {
      errors.push('generation input exerciseCount must match difficultySequence length');
    }
  }

  if (schemaId.endsWith('/tutor-cycle-attempt-v1.json')) {
    const expectedAttemptId = `${value.cycleId}:${value.stage}:${value.attemptVersion}`;
    if (value.attemptId !== expectedAttemptId) {
      errors.push('attemptId must equal cycleId:stage:attemptVersion');
    }
    if (value.submittedByChildId !== value.childId) {
      errors.push('submittedByChildId must equal the attempt childId');
    }
    if (
      value.review &&
      value.review.stateVersionAfter !== value.review.stateVersionBefore + 1
    ) {
      errors.push('attempt review must increment the cycle stateVersion exactly once');
    }
    if (
      value.review &&
      Date.parse(value.review.reviewedAt) < Date.parse(value.submittedAt)
    ) {
      errors.push('attempt reviewedAt must not precede submittedAt');
    }
  }

  if (schemaId.endsWith('/tutor-artifact-v1.json')) {
    if (value.contentHash !== computeContentHash(value.content)) {
      errors.push('contentHash must equal SHA-256 of RFC 8785 JCS(content)');
    }
    validatePracticeContent(value.content);
    const curriculumSourcesByNodeId = new Map();
    for (const source of value.curriculumSources || []) {
      if (curriculumSourcesByNodeId.has(source.nodeId)) {
        const existing = curriculumSourcesByNodeId.get(source.nodeId);
        errors.push(
          existing.datasetVersion === source.datasetVersion
            ? `curriculum source ${source.nodeId} is duplicated`
            : `curriculum source ${source.nodeId} has conflicting dataset versions`
        );
        continue;
      }
      curriculumSourcesByNodeId.set(source.nodeId, source);
    }

    const requireCurriculumSource = (nodeId, context) => {
      if (!curriculumSourcesByNodeId.has(nodeId)) {
        errors.push(`${context} ${nodeId} is missing from curriculumSources`);
        return null;
      }
      return curriculumSourcesByNodeId.get(nodeId);
    };

    for (const nodeId of value.content?.targetCurriculumNodeIds || []) {
      requireCurriculumSource(nodeId, 'content target');
    }

    if (value.content?.schemaVersion === 'explanation-v1') {
      for (const prerequisite of value.content.prerequisites || []) {
        requireCurriculumSource(prerequisite.curriculumNodeId, 'prerequisite');
      }
      for (const citation of value.content.citations || []) {
        const source = requireCurriculumSource(citation.curriculumNodeId, 'citation');
        if (source && source.datasetVersion !== citation.datasetVersion) {
          errors.push(
            `citation ${citation.curriculumNodeId} datasetVersion must match curriculum source`
          );
        }
      }
    }

    if (value.content?.schemaVersion === 'practice-v1') {
      const topLevelTargets = new Set(value.content.targetCurriculumNodeIds || []);
      for (const exercise of value.content.exercises || []) {
        for (const nodeId of exercise.targetNodeIds || []) {
          requireCurriculumSource(nodeId, `exercise ${exercise.exerciseId} target`);
          if (!topLevelTargets.has(nodeId)) {
            errors.push(
              `exercise ${exercise.exerciseId} target ${nodeId} must be a top-level practice target`
            );
          }
        }
      }
    }
  }

  if (schemaId.endsWith('/tutor-learning-cycle-v1.json')) {
    if (value.activeSourceMistakeKey !== undefined) {
      const expectedActiveKey = `${value.familyId}:${value.sourceMistakeId}`;
      if (value.activeSourceMistakeKey !== expectedActiveKey) {
        errors.push('activeSourceMistakeKey must equal familyId:sourceMistakeId');
      }
    }
    if (value.finalReview) {
      for (const field of [
        'cycleId',
        'familyId',
        'childId',
        'sourceMistakeId',
        'knowledgePointId'
      ]) {
        if (value[field] !== value.finalReview[field]) {
          errors.push(`cycle ${field} must equal finalReview.${field}`);
        }
      }
      if (value.finalReview.finalReviewHash !== computeFinalReviewHash(value.finalReview)) {
        errors.push('cycle finalReviewHash must match its immutable snapshot');
      }
      if (
        value.currentPracticeAttemptId !== value.finalReview.practiceAttemptId ||
        value.currentPracticeAttemptVersion !== value.finalReview.practiceAttemptVersion
      ) {
        errors.push('cycle finalReview must bind the current practice attempt pointer');
      }
    }
    if (value.status === 'cancelled') {
      errors.push(...cancelledCycleProjectionErrors(value));
    }
  }

  if (schemaId.endsWith('/tutor-final-review-snapshot-v1.json')) {
    if (value.finalReviewHash !== computeFinalReviewHash(value)) {
      errors.push('finalReviewHash must match the ordered final-review snapshot fields');
    }
  }

  if (schemaId.endsWith('/tutor-idempotency-record-v1.json')) {
    const mutationSemantics = tutorMutationSemantics.get(value.endpointOperation);
    if (!mutationSemantics) {
      errors.push('idempotency endpointOperation must have public mutation semantics');
    } else {
      if (!mutationSemantics.allowedActorRoles.includes(value.createdBy?.role)) {
        errors.push('idempotency createdBy.role is not allowed for endpointOperation');
      }
      if (!matchesAnyTutorResponseVariant(value.responseReference, mutationSemantics)) {
        errors.push(
          'idempotency responseReference status and resource type must match an endpoint response variant'
        );
      }
    }
    if (
      (value.endpointOperation === 'cycle-create' && value.resource?.cycleId !== null) ||
      (value.endpointOperation !== 'cycle-create' &&
        (typeof value.resource?.cycleId !== 'string' || value.resource.cycleId.length === 0))
    ) {
      errors.push('idempotency resource cycleId must match the endpoint resource shape');
    }
    if (Date.parse(value.updatedAt) < Date.parse(value.createdAt)) {
      errors.push('idempotency updatedAt must not precede createdAt');
    }
    if (value.responseReference?.responseId !== computeTutorResponseId(value)) {
      errors.push('idempotency responseId must match the deterministic result reference');
    }
  }

  if (schemaId.endsWith('/tutor-finalization-command-v1.json')) {
    const finalReview = value.payload?.finalReview;
    for (const field of ['cycleId', 'familyId', 'childId']) {
      if (value[field] !== finalReview?.[field]) {
        errors.push(`command ${field} must equal payload.finalReview.${field}`);
      }
    }
    for (const field of ['finalReviewId', 'finalReviewVersion', 'finalReviewHash']) {
      if (value[field] !== finalReview?.[field]) {
        errors.push(`command ${field} must equal payload.finalReview.${field}`);
      }
    }
    if (finalReview?.finalReviewHash !== computeFinalReviewHash(finalReview)) {
      errors.push('payload finalReviewHash must match the ordered final-review snapshot fields');
    }
    if (value.payloadHash !== computePayloadHash(value.payload)) {
      errors.push('payloadHash must match [payload.schemaVersion, finalReviewHash]');
    }
  }

  return errors;
}

function finalizationBatchErrors(ajv, value) {
  const errors = [];
  const snapshotValidator = ajv.getSchema(
    'https://lms.family.local/schemas/tutor-final-review-snapshot-v1.json'
  );
  const commandValidator = ajv.getSchema(
    'https://lms.family.local/schemas/tutor-finalization-command-v1.json'
  );
  const attemptValidator = ajv.getSchema(
    'https://lms.family.local/schemas/tutor-cycle-attempt-v1.json'
  );
  const cycle = value?.cycle || {};
  const snapshot = cycle.finalReview;
  const attempt = value?.practiceAttempt || {};
  const review = attempt.review;

  if (!snapshotValidator || !snapshotValidator(snapshot)) {
    errors.push(
      `cycle finalReview is invalid: ${snapshotValidator?.errors ? ajv.errorsText(snapshotValidator.errors) : 'schema unavailable'}`
    );
  }
  if (snapshot?.finalReviewHash !== computeFinalReviewHash(snapshot)) {
    errors.push('cycle finalReviewHash must match the persisted final-review snapshot');
  }
  if (cycle.status !== 'parent_verified') {
    errors.push('cycle must remain parent_verified until both commands are acknowledged');
  }
  for (const field of ['cycleId', 'familyId', 'childId']) {
    if (cycle[field] !== snapshot?.[field]) {
      errors.push(`cycle ${field} must equal cycle.finalReview.${field}`);
    }
  }
  if (!attemptValidator || !attemptValidator(attempt)) {
    errors.push(
      `practiceAttempt is invalid: ${attemptValidator?.errors ? ajv.errorsText(attemptValidator.errors) : 'schema unavailable'}`
    );
  }
  errors.push(
    ...customContractErrors(
      'https://lms.family.local/schemas/tutor-cycle-attempt-v1.json',
      attempt
    ).map(message => `practiceAttempt: ${message}`)
  );
  for (const field of ['cycleId', 'familyId', 'childId']) {
    if (attempt[field] !== cycle[field]) {
      errors.push(`practiceAttempt ${field} must equal cycle.${field}`);
    }
  }
  if (attempt.stage !== 'practice') {
    errors.push('finalization practiceAttempt must be a practice attempt');
  }
  if (
    cycle.currentPracticeAttemptId !== attempt.attemptId ||
    cycle.currentPracticeAttemptVersion !== attempt.attemptVersion
  ) {
    errors.push('cycle current practice pointer must identify the exact practiceAttempt');
  }
  if (
    snapshot?.practiceAttemptId !== attempt.attemptId ||
    snapshot?.practiceAttemptVersion !== attempt.attemptVersion ||
    snapshot?.practiceReviewOperationId !== review?.reviewOperationId
  ) {
    errors.push('finalReview must identify the exact reviewed practiceAttempt');
  }
  for (const field of ['decision', 'evidenceSummary', 'reviewedByParentId', 'reviewedAt']) {
    if (!isDeepStrictEqual(snapshot?.[field], review?.[field])) {
      errors.push(`finalReview ${field} must equal practiceAttempt.review.${field}`);
    }
  }
  if (
    review?.stateVersionAfter !== cycle.stateVersion ||
    review?.stateVersionBefore + 1 !== cycle.stateVersion
  ) {
    errors.push('practiceAttempt review versions must bind the parent_verified cycle version');
  }
  if (
    review?.reviewedAt !== cycle.lastTransitionAt ||
    cycle.updatedAt !== cycle.lastTransitionAt
  ) {
    errors.push('final review, cycle transition, and update timestamps must match');
  }

  const commands = Array.isArray(value?.commands) ? value.commands : [];
  if (commands.length !== 2) {
    errors.push('finalization batch must contain exactly two commands');
  }
  const targets = new Set(commands.map(command => command.target));
  if (
    targets.size !== 2 ||
    !targets.has('progress-service') ||
    !targets.has('analytics-service')
  ) {
    errors.push('finalization batch must contain exactly one command for each target');
  }

  for (const [index, command] of commands.entries()) {
    const commandValid = commandValidator ? commandValidator(command) : false;
    if (!commandValid) {
      errors.push(
        `commands[${index}] is invalid: ${commandValidator?.errors ? ajv.errorsText(commandValidator.errors) : 'schema unavailable'}`
      );
    }
    errors.push(
      ...customContractErrors(
        'https://lms.family.local/schemas/tutor-finalization-command-v1.json',
        command
      ).map(message => `commands[${index}]: ${message}`)
    );
    if (command.status !== 'acknowledged' || !command.responseId) {
      errors.push(`commands[${index}] must be acknowledged with a stable responseId`);
    }
    if (!isDeepStrictEqual(command.payload?.finalReview, snapshot)) {
      errors.push(`commands[${index}] must carry the exact persisted finalReview snapshot`);
    }
  }

  return errors;
}

function artifactReviewCasErrors(ajv, value) {
  const errors = [];
  const requestValidator = ajv.getSchema(
    'https://lms.family.local/schemas/tutor-artifact-review-request-v1.json'
  );
  if (!requestValidator || !requestValidator(value?.request)) {
    errors.push(
      `review request is invalid: ${requestValidator?.errors ? ajv.errorsText(requestValidator.errors) : 'schema unavailable'}`
    );
  }

  const request = value?.request || {};
  const artifact = value?.artifact || {};
  const cycle = value?.cycle || {};
  if (artifact.artifactId !== request.artifactId) {
    errors.push('request artifactId must match the candidate artifact');
  }
  if (artifact.version !== request.artifactVersion) {
    errors.push('request artifactVersion must match the candidate artifact');
  }
  if (artifact.contentHash !== request.contentHash) {
    errors.push('request contentHash must match the candidate artifact');
  }
  if (artifact.contentHash !== computeContentHash(artifact.content)) {
    errors.push('candidate artifact contentHash must match its canonical content');
  }
  if (artifact.reviewVersion !== request.expectedArtifactReviewVersion) {
    errors.push('artifact reviewVersion CAS failed');
  }
  if (artifact.status !== 'candidate') {
    errors.push('artifact must still be candidate');
  }
  if (cycle.stateVersion !== request.expectedStateVersion) {
    errors.push('cycle stateVersion CAS failed');
  }
  const expectedCycleStatus =
    artifact.kind === 'explanation'
      ? 'explanation_pending_review'
      : artifact.kind === 'practice'
        ? 'practice_pending_review'
        : null;
  if (!expectedCycleStatus || cycle.status !== expectedCycleStatus) {
    errors.push('cycle must still be in the matching pending-review state');
  }
  if (artifact.cycleId !== cycle.cycleId) {
    errors.push('artifact must belong to the reviewed cycle');
  }

  return errors;
}

function cycleCreateConsistencyErrors(ajv, value) {
  const errors = [];
  const requestValidator = ajv.getSchema(
    'https://lms.family.local/schemas/tutor-cycle-create-request-v1.json'
  );
  if (!requestValidator || !requestValidator(value?.request)) {
    errors.push(
      `cycle create request is invalid: ${requestValidator?.errors ? ajv.errorsText(requestValidator.errors) : 'schema unavailable'}`
    );
  }

  const request = value?.request || {};
  const mistake = value?.mistake || {};
  const knowledgePoint = value?.knowledgePoint || {};
  for (const record of [mistake, knowledgePoint]) {
    if (record.familyId !== value.actorFamilyId) {
      errors.push('source records must belong to the authenticated family');
    }
    if (record.childId !== request.childId) {
      errors.push('source records must belong to the requested child');
    }
  }
  if (mistake.mistakeId !== request.sourceMistakeId) {
    errors.push('request sourceMistakeId must match the loaded mistake');
  }
  if (
    mistake.knowledgePointId !== request.knowledgePointId ||
    knowledgePoint.knowledgePointId !== request.knowledgePointId
  ) {
    errors.push('mistake and request must reference the loaded knowledge point');
  }
  if (request.presentedByGrowthTaskId !== null) {
    const growthTask = value.growthTask;
    if (
      !growthTask ||
      growthTask.growthTaskId !== request.presentedByGrowthTaskId ||
      growthTask.familyId !== value.actorFamilyId ||
      growthTask.childId !== request.childId
    ) {
      errors.push('optional growth task entry must belong to the same family and child');
    }
  }
  if (value.activeCycleCountForMistake !== 0) {
    errors.push('pre-query found another active tutor cycle');
  }
  const expectedActiveSourceMistakeKey = `${value.actorFamilyId}:${request.sourceMistakeId}`;
  if (value.activeSourceMistakeKey !== expectedActiveSourceMistakeKey) {
    errors.push('activeSourceMistakeKey must be derived from familyId and sourceMistakeId');
  }
  if (value.activeSourceMistakeKeyConflict) {
    errors.push('duplicate activeSourceMistakeKey must return ACTIVE_TUTOR_CYCLE_EXISTS');
  }

  return errors;
}

function cycleTransitionErrors(ajv, value) {
  const errors = [];
  const cycleValidator = ajv.getSchema(
    'https://lms.family.local/schemas/tutor-learning-cycle-v1.json'
  );
  const before = value?.before || {};
  const after = value?.after || {};

  for (const [label, cycle] of [
    ['before', before],
    ['after', after]
  ]) {
    if (!cycleValidator || !cycleValidator(cycle)) {
      errors.push(
        `${label} cycle is invalid: ${cycleValidator?.errors ? ajv.errorsText(cycleValidator.errors) : 'schema unavailable'}`
      );
    }
    errors.push(
      ...customContractErrors(
        'https://lms.family.local/schemas/tutor-learning-cycle-v1.json',
        cycle
      ).map(message => `${label} cycle: ${message}`)
    );
  }

  for (const field of [
    'schemaVersion',
    'cycleId',
    'familyId',
    'childId',
    'createdByParentId',
    'sourceMistakeId',
    'knowledgePointId',
    'createdAt'
  ]) {
    if (!isDeepStrictEqual(before[field], after[field])) {
      errors.push(`cycle transition must preserve ${field}`);
    }
  }

  const stateMachine = JSON.parse(read('docs/contracts/tutor-cycle-state-machine.json'));
  if (!(stateMachine.states?.[before.status] || []).includes(after.status)) {
    errors.push(`cycle transition ${before.status} -> ${after.status} is not allowed`);
  }
  if (after.stateVersion !== before.stateVersion + 1) {
    errors.push('cycle transition must increment stateVersion exactly once');
  }
  if (
    Date.parse(after.lastTransitionAt) <= Date.parse(before.lastTransitionAt) ||
    after.updatedAt !== after.lastTransitionAt
  ) {
    errors.push('cycle transition timestamps must advance together');
  }

  const projectionFields = Object.values(cycleProjectionFieldGroups).flat();
  if (after.status === 'cancelled') {
    if (after.cancelledFromStatus !== before.status) {
      errors.push('cancelledFromStatus must equal the status immediately before cancellation');
    }
    for (const field of projectionFields) {
      if (!isDeepStrictEqual(before[field], after[field])) {
        errors.push(`cancellation must preserve existing cycle projection field ${field}`);
      }
    }
  }

  for (const [stage, fromStatus, submittedStatus, idField, versionField] of [
    [
      'correction',
      'correction_in_progress',
      'correction_submitted',
      'currentCorrectionAttemptId',
      'currentCorrectionAttemptVersion'
    ],
    [
      'practice',
      'practice_in_progress',
      'practice_submitted',
      'currentPracticeAttemptId',
      'currentPracticeAttemptVersion'
    ]
  ]) {
    const createsAttempt = before.status === fromStatus && after.status === submittedStatus;
    if (createsAttempt) {
      const expectedVersion = (before[versionField] || 0) + 1;
      if (after[versionField] !== expectedVersion) {
        errors.push(`${stage} submission must increment its attemptVersion exactly once`);
      }
      if (after[idField] !== `${after.cycleId}:${stage}:${expectedVersion}`) {
        errors.push(`${stage} submission must bind the exact new attemptId`);
      }
    } else if (
      !isDeepStrictEqual(before[idField], after[idField]) ||
      !isDeepStrictEqual(before[versionField], after[versionField])
    ) {
      errors.push(`${stage} attempt projection may change only on ${submittedStatus}`);
    }
  }

  return errors;
}

function cycleReviewTransactionErrors(ajv, value) {
  const errors = [];
  const attemptValidator = ajv.getSchema(
    'https://lms.family.local/schemas/tutor-cycle-attempt-v1.json'
  );
  const commandValidator = ajv.getSchema(
    'https://lms.family.local/schemas/tutor-finalization-command-v1.json'
  );
  const before = value?.beforeAttempt || {};
  const after = value?.afterAttempt || {};
  const beforeCycle = value?.beforeCycle || {};
  const afterCycle = value?.afterCycle || {};
  const endpointOperation = value?.endpointOperation;
  const requestSchemaId =
    endpointOperation === 'correction-review'
      ? 'https://lms.family.local/schemas/tutor-correction-review-request-v1.json'
      : endpointOperation === 'final-review'
        ? 'https://lms.family.local/schemas/tutor-final-review-request-v1.json'
        : null;
  const requestValidator = requestSchemaId ? ajv.getSchema(requestSchemaId) : null;
  if (!requestValidator || !requestValidator(value?.request)) {
    errors.push(
      `review request is invalid: ${requestValidator?.errors ? ajv.errorsText(requestValidator.errors) : 'schema unavailable'}`
    );
  }
  errors.push(
    ...cycleTransitionErrors(ajv, { before: beforeCycle, after: afterCycle }).map(
      message => `cycle: ${message}`
    )
  );
  for (const [label, attempt] of [
    ['before', before],
    ['after', after]
  ]) {
    if (!attemptValidator || !attemptValidator(attempt)) {
      errors.push(
        `${label} attempt is invalid: ${attemptValidator?.errors ? ajv.errorsText(attemptValidator.errors) : 'schema unavailable'}`
      );
    }
    errors.push(
      ...customContractErrors(
        'https://lms.family.local/schemas/tutor-cycle-attempt-v1.json',
        attempt
      ).map(message => `${label} attempt: ${message}`)
    );
  }

  for (const field of [
    'schemaVersion',
    'attemptId',
    'cycleId',
    'familyId',
    'childId',
    'stage',
    'attemptVersion',
    'mediaIds',
    'submissionOperationId',
    'submittedByChildId',
    'submittedAt'
  ]) {
    if (!isDeepStrictEqual(before[field], after[field])) {
      errors.push(`attempt review must preserve immutable submission field ${field}`);
    }
  }
  if (before.review !== null) {
    errors.push('an existing attempt review must never be overwritten');
  }
  if (after.review === null) {
    errors.push('attempt review transition must append one review');
  }

  const request = value?.request || {};
  const review = after.review || {};
  if (request.expectedStateVersion !== beforeCycle.stateVersion) {
    errors.push('review request expectedStateVersion must equal beforeCycle.stateVersion');
  }
  for (const field of ['cycleId', 'familyId', 'childId']) {
    if (before[field] !== beforeCycle[field] || after[field] !== afterCycle[field]) {
      errors.push(`reviewed attempt ${field} must equal its cycle ${field}`);
    }
  }
  if (
    beforeCycle.familyId !== value?.actorFamilyId ||
    review.reviewedByParentId !== value?.actorParentId
  ) {
    errors.push('review transaction must bind the authenticated family and parent');
  }
  if (
    review.stateVersionBefore !== beforeCycle.stateVersion ||
    review.stateVersionAfter !== afterCycle.stateVersion
  ) {
    errors.push('attempt review versions must equal the before and after cycle versions');
  }
  if (review.reviewOperationId !== request.operationId) {
    errors.push('attempt reviewOperationId must equal request.operationId');
  }
  if (
    Date.parse(review.reviewedAt) < Date.parse(after.submittedAt) ||
    review.reviewedAt !== afterCycle.lastTransitionAt ||
    afterCycle.updatedAt !== afterCycle.lastTransitionAt
  ) {
    errors.push('attempt submission, review, and cycle transition timestamps are inconsistent');
  }

  const stage = endpointOperation === 'correction-review' ? 'correction' : 'practice';
  const idField =
    stage === 'correction' ? 'currentCorrectionAttemptId' : 'currentPracticeAttemptId';
  const versionField =
    stage === 'correction'
      ? 'currentCorrectionAttemptVersion'
      : 'currentPracticeAttemptVersion';
  if (
    before.stage !== stage ||
    beforeCycle[idField] !== before.attemptId ||
    beforeCycle[versionField] !== before.attemptVersion ||
    afterCycle[idField] !== after.attemptId ||
    afterCycle[versionField] !== after.attemptVersion
  ) {
    errors.push(`cycle ${stage} pointer must identify the exact reviewed attempt`);
  }
  if (
    review.decision !== request.decision ||
    !isDeepStrictEqual(review.comment, request.comment)
  ) {
    errors.push('persisted attempt review must match the request decision and comment');
  }

  const expectedBeforeStatus =
    endpointOperation === 'correction-review' ? 'correction_submitted' : 'practice_submitted';
  const expectedAfterStatus =
    endpointOperation === 'correction-review'
      ? request.decision === 'approve'
        ? 'correction_approved'
        : 'correction_needs_revision'
      : request.decision === 'mastered'
        ? 'parent_verified'
        : 'practice_needs_revision';
  if (
    beforeCycle.status !== expectedBeforeStatus ||
    afterCycle.status !== expectedAfterStatus
  ) {
    errors.push('cycle review states must match the endpoint operation and decision');
  }

  const commands = Array.isArray(value?.commands) ? value.commands : [];
  if (endpointOperation === 'correction-review') {
    if (review.evidenceSummary !== null || commands.length !== 0) {
      errors.push('correction review must not persist mastery evidence or finalization commands');
    }
  } else {
    if (!isDeepStrictEqual(review.evidenceSummary, request.evidenceSummary)) {
      errors.push('practice review evidenceSummary must equal the final-review request');
    }
    if (request.decision === 'mastered') {
      const snapshot = afterCycle.finalReview;
      if (
        snapshot?.practiceAttemptId !== after.attemptId ||
        snapshot?.practiceAttemptVersion !== after.attemptVersion ||
        snapshot?.practiceReviewOperationId !== review.reviewOperationId
      ) {
        errors.push('mastered finalReview must identify the exact reviewed practice attempt');
      }
      for (const field of [
        'decision',
        'evidenceSummary',
        'reviewedByParentId',
        'reviewedAt'
      ]) {
        if (!isDeepStrictEqual(snapshot?.[field], review[field])) {
          errors.push(`mastered finalReview ${field} must equal the practice attempt review`);
        }
      }
      const targets = new Set(commands.map(command => command.target));
      if (
        commands.length !== 2 ||
        targets.size !== 2 ||
        !targets.has('progress-service') ||
        !targets.has('analytics-service') ||
        commands.some(command => !isDeepStrictEqual(command.payload?.finalReview, snapshot))
      ) {
        errors.push('mastered review must create two commands carrying the exact finalReview');
      }
      for (const [index, command] of commands.entries()) {
        if (!commandValidator || !commandValidator(command)) {
          errors.push(
            `commands[${index}] is invalid: ${commandValidator?.errors ? ajv.errorsText(commandValidator.errors) : 'schema unavailable'}`
          );
        }
        errors.push(
          ...customContractErrors(
            'https://lms.family.local/schemas/tutor-finalization-command-v1.json',
            command
          ).map(message => `commands[${index}]: ${message}`)
        );
        for (const field of ['cycleId', 'familyId', 'childId']) {
          if (command[field] !== afterCycle[field]) {
            errors.push(`commands[${index}] ${field} must equal afterCycle.${field}`);
          }
        }
        for (const field of ['finalReviewId', 'finalReviewVersion', 'finalReviewHash']) {
          if (command[field] !== snapshot?.[field]) {
            errors.push(`commands[${index}] ${field} must equal afterCycle.finalReview.${field}`);
          }
        }
        const targetSuffix =
          command.target === 'progress-service'
            ? 'progress'
            : command.target === 'analytics-service'
              ? 'analytics'
              : null;
        const expectedOperationId = targetSuffix
          ? `${afterCycle.cycleId}:final-review:${snapshot?.finalReviewVersion}:${targetSuffix}`
          : null;
        if (!expectedOperationId || command.operationId !== expectedOperationId) {
          errors.push(`commands[${index}] must use the stable target operationId`);
        }
        if (command.status !== 'pending') {
          errors.push(`commands[${index}] must start in pending state`);
        }
      }
    } else if (afterCycle.finalReview !== undefined || commands.length !== 0) {
      errors.push('revise review must not create finalReview or finalization commands');
    }
  }

  return errors;
}

function requestPayloadHashErrors(ajv, value) {
  const errors = [];
  const stateMachine = JSON.parse(read('docs/contracts/tutor-cycle-state-machine.json'));
  const mutationCandidates = (stateMachine.publicMutations || []).filter(
    mutation =>
      mutation.endpointOperation === value?.endpointOperation &&
      mutation.route === value?.route
  );
  const requestSchemaIds = new Set(
    mutationCandidates.map(mutation => mutation.requestSchemaId)
  );
  if (requestSchemaIds.size > 1) {
    errors.push(`endpointOperation ${value?.endpointOperation} maps to conflicting schemas`);
  }
  const requestSchemaId = mutationCandidates[0]?.requestSchemaId;
  const requestValidator = requestSchemaId ? ajv.getSchema(requestSchemaId) : null;
  if (!requestValidator || !requestValidator(value?.request)) {
    errors.push(
      `request is invalid for ${value?.endpointOperation}: ${requestValidator?.errors ? ajv.errorsText(requestValidator.errors) : 'schema unavailable'}`
    );
  }
  const discriminatorMatches = mutationCandidates.some(mutation =>
    Object.entries(mutation.discriminator || {}).every(
      ([field, expectedValue]) => value?.request?.[field] === expectedValue
    )
  );
  if (!discriminatorMatches) {
    errors.push(`request discriminator does not match ${value?.route}`);
  }
  const resource = value?.resource;
  const matchedPathParams = value?.matchedPathParams;
  if (
    !matchedPathParams ||
    Array.isArray(matchedPathParams) ||
    !sameSet(new Set(Object.keys(matchedPathParams)), new Set(['cycleId']))
  ) {
    errors.push('matchedPathParams must contain exactly the server-matched cycleId');
  }
  if (
    !resource ||
    Array.isArray(resource) ||
    !sameSet(new Set(Object.keys(resource)), new Set(['cycleId']))
  ) {
    errors.push('request hash resource must contain exactly cycleId');
  } else if (value?.endpointOperation === 'cycle-create') {
    if (resource.cycleId !== null) {
      errors.push('cycle-create request hash resource.cycleId must be null');
    }
  } else if (typeof resource.cycleId !== 'string' || resource.cycleId.length === 0) {
    errors.push('cycle-scoped request hash resource.cycleId must be the URL cycleId');
  }
  if (resource?.cycleId !== matchedPathParams?.cycleId) {
    errors.push('request hash resource.cycleId must equal matchedPathParams.cycleId');
  }
  if (
    value.requestPayloadHash !==
    computeRequestPayloadHash(value.endpointOperation, value.resource, value.request)
  ) {
    errors.push('requestPayloadHash must match the canonical operation request');
  }
  return errors;
}

function idempotencyDecisionErrors(ajv, value) {
  const errors = [];
  const incoming = value?.incoming || {};
  const actor = value?.actor || {};
  const authorizedResource = value?.authorizedResource || {};
  const mutationSemantics = tutorMutationSemantics.get(incoming.endpointOperation);
  const responseVariant = resolveTutorResponseVariant(
    mutationSemantics,
    incoming.request
  );
  const actorShapeValid =
    sameSet(
      new Set(Object.keys(actor)),
      new Set([
        'userId',
        'role',
        'accountStatus',
        'familyId',
        'childId',
        'activeParentMembership'
      ])
    ) &&
    typeof actor.userId === 'string' &&
    actor.userId.length > 0 &&
    ['parent', 'child'].includes(actor.role) &&
    ['active', 'disabled', 'deleted'].includes(actor.accountStatus) &&
    typeof actor.familyId === 'string' &&
    actor.familyId.length > 0 &&
    typeof actor.activeParentMembership === 'boolean' &&
    (actor.role === 'parent'
      ? actor.childId === null
      : typeof actor.childId === 'string' && actor.childId.length > 0);
  const resourceShapeValid =
    sameSet(
      new Set(Object.keys(authorizedResource)),
      new Set(['exists', 'cycleId', 'familyId', 'childId'])
    ) &&
    typeof authorizedResource.exists === 'boolean' &&
    (authorizedResource.cycleId === null ||
      (typeof authorizedResource.cycleId === 'string' &&
        authorizedResource.cycleId.length > 0)) &&
    typeof authorizedResource.familyId === 'string' &&
    authorizedResource.familyId.length > 0 &&
    typeof authorizedResource.childId === 'string' &&
    authorizedResource.childId.length > 0;
  if (!actorShapeValid) {
    errors.push('authorization actor context is invalid');
  }
  if (!resourceShapeValid) {
    errors.push('authorization resource context is invalid');
  }

  const resourceMatchesRequest =
    authorizedResource.cycleId === incoming.matchedPathParams?.cycleId &&
    authorizedResource.cycleId === incoming.resource?.cycleId;
  const commonAuthorization =
    actorShapeValid &&
    resourceShapeValid &&
    actor.accountStatus === 'active' &&
    authorizedResource.exists === true &&
    actor.familyId === incoming.actorFamilyId &&
    actor.familyId === authorizedResource.familyId &&
    resourceMatchesRequest;
  const roleAuthorized =
    Boolean(mutationSemantics?.allowedActorRoles.includes(actor.role)) &&
    (actor.role === 'parent'
      ? actor.activeParentMembership === true
      : actor.activeParentMembership === false &&
        actor.childId === authorizedResource.childId);
  const authorized = commonAuthorization && roleAuthorized;
  const expected = value?.expected || {};

  if (!authorized) {
    if (
      !sameSet(
        new Set(Object.keys(expected)),
        new Set(['decision', 'status', 'errorCode', 'idempotencyLookup'])
      ) ||
      expected.decision !== 'deny' ||
      expected.status !== 404 ||
      expected.errorCode !== 'RESOURCE_NOT_FOUND' ||
      expected.idempotencyLookup !== 'skipped'
    ) {
      errors.push('unauthorized request must return 404 before idempotency lookup');
    }
    return errors;
  }

  errors.push(
    ...requestPayloadHashErrors(ajv, incoming).map(
      message => `incoming request: ${message}`
    )
  );

  const stored = value?.stored;
  let actualDecision = 'execute';
  if (stored !== null && stored !== undefined) {
    const storedSchemaId =
      'https://lms.family.local/schemas/tutor-idempotency-record-v1.json';
    const storedValidator = ajv.getSchema(storedSchemaId);
    if (!storedValidator || !storedValidator(stored)) {
      errors.push(
        `stored idempotency record is invalid: ${storedValidator?.errors ? ajv.errorsText(storedValidator.errors) : 'schema unavailable'}`
      );
    }
    errors.push(
      ...customContractErrors(storedSchemaId, stored).map(
        message => `stored idempotency record: ${message}`
      )
    );
    const sameScope =
      stored.familyId === incoming.actorFamilyId &&
      stored.endpointOperation === incoming.endpointOperation &&
      stored.operationId === incoming.request?.operationId;
    if (sameScope) {
      if (stored.requestPayloadHash !== incoming.requestPayloadHash) {
        actualDecision = 'conflict';
      } else {
        const referencedEntity = value?.referencedEntity;
        const referenceExistsShape =
          referencedEntity &&
          !Array.isArray(referencedEntity) &&
          sameSet(new Set(Object.keys(referencedEntity)), new Set(['exists'])) &&
          referencedEntity.exists === false;
        const referenceLoadedShape =
          referencedEntity &&
          !Array.isArray(referencedEntity) &&
          sameSet(
            new Set(Object.keys(referencedEntity)),
            new Set([
              'exists',
              'resourceType',
              'resourceId',
              'familyId',
              'childId',
              'cycleId'
            ])
          ) &&
          referencedEntity.exists === true &&
          ['resourceType', 'resourceId', 'familyId', 'childId', 'cycleId'].every(
            field =>
              typeof referencedEntity[field] === 'string' &&
              referencedEntity[field].length > 0
          );
        if (!referenceExistsShape && !referenceLoadedShape) {
          errors.push('referencedEntity must be an exact missing or loaded entity projection');
        }

        const referenceMatches =
          referenceLoadedShape &&
          Boolean(mutationSemantics) &&
          mutationSemantics.allowedActorRoles.includes(stored.createdBy?.role) &&
          matchesTutorResponseVariant(stored.responseReference, responseVariant) &&
          referencedEntity.resourceType === stored.responseReference?.resourceType &&
          referencedEntity.resourceId === stored.responseReference?.resourceId &&
          referencedEntity.familyId === stored.familyId &&
          referencedEntity.childId === stored.childId &&
          referencedEntity.familyId === authorizedResource.familyId &&
          referencedEntity.childId === authorizedResource.childId &&
          (stored.endpointOperation === 'cycle-create'
            ? stored.resource?.cycleId === null &&
              referencedEntity.resourceType === 'TutorLearningCycle' &&
              referencedEntity.cycleId === stored.responseReference?.resourceId
            : referencedEntity.cycleId === stored.resource?.cycleId &&
              referencedEntity.cycleId === authorizedResource.cycleId);
        actualDecision = referenceMatches ? 'replay' : 'not-found';
      }
    }
  }

  if (expected.decision !== actualDecision) {
    errors.push(
      `idempotency decision must be ${actualDecision}, got ${expected.decision}`
    );
  }
  if (actualDecision === 'execute') {
    if (!sameSet(new Set(Object.keys(expected)), new Set(['decision']))) {
      errors.push('execute expectation must contain only decision');
    }
  } else if (actualDecision === 'replay') {
    if (
      !sameSet(
        new Set(Object.keys(expected)),
        new Set(['decision', 'responseReference', 'responseMode'])
      ) ||
      expected.responseMode !== 'rebuild-authorized' ||
      !isDeepStrictEqual(expected.responseReference, stored?.responseReference)
    ) {
      errors.push('replay must rebuild the authorized response from the stored reference');
    }
    if (
      stored?.familyId !== authorizedResource.familyId ||
      stored?.childId !== authorizedResource.childId ||
      stored?.resource?.cycleId !== authorizedResource.cycleId
    ) {
      errors.push('replay record must belong to the currently authorized resource');
    }
  } else if (actualDecision === 'not-found') {
    if (
      !sameSet(
        new Set(Object.keys(expected)),
        new Set(['decision', 'status', 'errorCode', 'reexecute'])
      ) ||
      expected.status !== 404 ||
      expected.errorCode !== 'RESOURCE_NOT_FOUND' ||
      expected.reexecute !== false
    ) {
      errors.push('missing or mismatched replay reference must return 404 without reexecution');
    }
  } else if (
    !sameSet(
      new Set(Object.keys(expected)),
      new Set(['decision', 'status', 'errorCode'])
    ) ||
    expected.status !== 409 ||
    expected.errorCode !== 'IDEMPOTENCY_KEY_REUSED'
  ) {
    errors.push('conflict must return 409 IDEMPOTENCY_KEY_REUSED');
  }

  return errors;
}

function idempotencyFirstWriteErrors(value) {
  const errors = [];
  if (
    !value ||
    Array.isArray(value) ||
    !sameSet(
      new Set(Object.keys(value)),
      new Set(['scenario', 'transactionBoundary', 'attempts', 'expected'])
    )
  ) {
    errors.push('public Tutor first-write fixture must use the closed transaction projection');
  }
  const boundary = value?.transactionBoundary || {};
  const expectedAtomicWrites = new Set([
    'authoritative-business-write',
    'cycle-cas',
    'local-job-or-outbox',
    'tutor-idempotency-record'
  ]);
  if (
    !sameSet(
      new Set(Object.keys(boundary)),
      new Set([
        'datastore',
        'atomicWrites',
        'irreversibleExternalSideEffectsBeforeCommit'
      ])
    ) ||
    boundary.datastore !== 'homework-service-mongodb' ||
    !Array.isArray(boundary.atomicWrites) ||
    !sameSet(new Set(boundary.atomicWrites), expectedAtomicWrites) ||
    boundary.irreversibleExternalSideEffectsBeforeCommit !== false
  ) {
    errors.push('public Tutor first write must use one local transaction with no pre-commit irreversible external side effect');
  }

  const attempts = Array.isArray(value?.attempts) ? value.attempts : [];
  if (new Set(attempts.map(attempt => attempt?.name)).size !== attempts.length) {
    errors.push('first-write attempt names must be unique');
  }
  for (const attempt of attempts) {
    if (
      !sameSet(
        new Set(Object.keys(attempt)),
        new Set([
          'name',
          'requestPayloadHash',
          'outcome',
          'businessWriteCommitted',
          'idempotencyRecordCommitted'
        ])
      ) ||
      typeof attempt.name !== 'string' ||
      !/^sha256:[a-f0-9]{64}$/.test(attempt.requestPayloadHash || '') ||
      ![
        'committed',
        'duplicate-key-aborted',
        'write-conflict-aborted',
        'crash-before-commit',
        'committed-response-lost'
      ].includes(attempt.outcome) ||
      typeof attempt.businessWriteCommitted !== 'boolean' ||
      typeof attempt.idempotencyRecordCommitted !== 'boolean'
    ) {
      errors.push('first-write attempt projection is invalid');
      continue;
    }
    const transactionCommitted = ['committed', 'committed-response-lost'].includes(
      attempt.outcome
    );
    if (
      attempt.businessWriteCommitted !== transactionCommitted ||
      attempt.idempotencyRecordCommitted !== transactionCommitted
    ) {
      errors.push('business and idempotency writes must commit or abort together');
    }
  }

  let computedExpected = null;
  const committedAttempts = attempts.filter(attempt =>
    ['committed', 'committed-response-lost'].includes(attempt.outcome)
  );
  if (value?.scenario === 'same-hash-race') {
    if (
      attempts.length !== 2 ||
      committedAttempts.length !== 1 ||
      attempts.filter(attempt =>
        ['duplicate-key-aborted', 'write-conflict-aborted'].includes(attempt.outcome)
      ).length !== 1 ||
      attempts[0]?.requestPayloadHash !== attempts[1]?.requestPayloadHash
    ) {
      errors.push('same-hash race must have one committed winner and one aborted loser');
    }
    computedExpected = {
      committedBusinessEffects: 1,
      committedIdempotencyRecords: 1,
      retryDecision: 'replay'
    };
  } else if (value?.scenario === 'different-hash-race') {
    if (
      attempts.length !== 2 ||
      committedAttempts.length !== 1 ||
      attempts.filter(attempt =>
        ['duplicate-key-aborted', 'write-conflict-aborted'].includes(attempt.outcome)
      ).length !== 1 ||
      attempts[0]?.requestPayloadHash === attempts[1]?.requestPayloadHash
    ) {
      errors.push('different-hash race must have one committed winner and one aborted loser');
    }
    computedExpected = {
      committedBusinessEffects: 1,
      committedIdempotencyRecords: 1,
      retryDecision: 'conflict'
    };
  } else if (value?.scenario === 'crash-before-commit') {
    if (
      attempts.length !== 1 ||
      attempts[0]?.outcome !== 'crash-before-commit' ||
      committedAttempts.length !== 0
    ) {
      errors.push('crash-before-commit must abort the entire local transaction');
    }
    computedExpected = {
      committedBusinessEffects: 0,
      committedIdempotencyRecords: 0,
      retryDecision: 'execute'
    };
  } else if (value?.scenario === 'crash-after-commit') {
    if (
      attempts.length !== 1 ||
      attempts[0]?.outcome !== 'committed-response-lost' ||
      committedAttempts.length !== 1
    ) {
      errors.push('crash-after-commit must leave both local writes committed');
    }
    computedExpected = {
      committedBusinessEffects: 1,
      committedIdempotencyRecords: 1,
      retryDecision: 'replay'
    };
  } else {
    errors.push('unknown public Tutor first-write scenario');
  }

  if (!isDeepStrictEqual(value?.expected, computedExpected)) {
    errors.push('first-write expected outcome does not match the atomic transaction result');
  }
  return errors;
}

function idempotencyRecordCommitErrors(ajv, value) {
  const errors = [];
  if (
    !value ||
    Array.isArray(value) ||
    !sameSet(
      new Set(Object.keys(value)),
      new Set([
        'actor',
        'authorizedResource',
        'incoming',
        'committedEntity',
        'actualResult',
        'persistedRecord',
        'commitContext'
      ])
    )
  ) {
    errors.push('idempotency commit fixture must use the closed commit projection');
  }
  const actor = value?.actor || {};
  const incoming = value?.incoming || {};
  const authorizedResource = value?.authorizedResource || {};
  const committedEntity = value?.committedEntity || {};
  const actualResult = value?.actualResult || {};
  const persistedRecord = value?.persistedRecord || {};
  const commitContext = value?.commitContext || {};
  const mutationSemantics = tutorMutationSemantics.get(incoming.endpointOperation);
  const responseVariant = resolveTutorResponseVariant(
    mutationSemantics,
    incoming.request
  );

  if (
    !sameSet(
      new Set(Object.keys(incoming)),
      new Set([
        'actorFamilyId',
        'endpointOperation',
        'route',
        'matchedPathParams',
        'resource',
        'request',
        'requestPayloadHash'
      ])
    )
  ) {
    errors.push('commit incoming request projection must be exact');
  }

  const actorShapeValid =
    sameSet(
      new Set(Object.keys(actor)),
      new Set([
        'userId',
        'role',
        'accountStatus',
        'familyId',
        'childId',
        'activeParentMembership'
      ])
    ) &&
    typeof actor.userId === 'string' &&
    actor.userId.length > 0 &&
    ['parent', 'child'].includes(actor.role) &&
    ['active', 'disabled', 'deleted'].includes(actor.accountStatus) &&
    typeof actor.familyId === 'string' &&
    actor.familyId.length > 0 &&
    typeof actor.activeParentMembership === 'boolean' &&
    (actor.role === 'parent'
      ? actor.childId === null
      : typeof actor.childId === 'string' && actor.childId.length > 0);
  const authorizedResourceShapeValid =
    sameSet(
      new Set(Object.keys(authorizedResource)),
      new Set(['exists', 'cycleId', 'familyId', 'childId'])
    ) &&
    typeof authorizedResource.exists === 'boolean' &&
    (authorizedResource.cycleId === null ||
      (typeof authorizedResource.cycleId === 'string' &&
        authorizedResource.cycleId.length > 0)) &&
    typeof authorizedResource.familyId === 'string' &&
    authorizedResource.familyId.length > 0 &&
    typeof authorizedResource.childId === 'string' &&
    authorizedResource.childId.length > 0;
  if (!actorShapeValid || !authorizedResourceShapeValid) {
    errors.push('commit actor and authorized resource projections must be exact');
  }

  errors.push(
    ...requestPayloadHashErrors(ajv, incoming).map(
      message => `incoming request: ${message}`
    )
  );
  const storedSchemaId =
    'https://lms.family.local/schemas/tutor-idempotency-record-v1.json';
  const storedValidator = ajv.getSchema(storedSchemaId);
  if (!storedValidator || !storedValidator(persistedRecord)) {
    errors.push(
      `persisted idempotency record is invalid: ${storedValidator?.errors ? ajv.errorsText(storedValidator.errors) : 'schema unavailable'}`
    );
  }
  errors.push(
    ...customContractErrors(storedSchemaId, persistedRecord).map(
      message => `persisted idempotency record: ${message}`
    )
  );

  if (
    !sameSet(
      new Set(Object.keys(commitContext)),
      new Set([
        'transactionId',
        'businessMutationCommitId',
        'idempotencyRecordCommitId',
        'irreversibleExternalSideEffectsBeforeCommit'
      ])
    ) ||
    typeof commitContext.transactionId !== 'string' ||
    commitContext.transactionId.length === 0 ||
    commitContext.businessMutationCommitId !== commitContext.transactionId ||
    commitContext.idempotencyRecordCommitId !== commitContext.transactionId ||
    commitContext.irreversibleExternalSideEffectsBeforeCommit !== false
  ) {
    errors.push('actual result and idempotency record must share one local commit boundary');
  }

  const committedEntityShapeValid =
    sameSet(
      new Set(Object.keys(committedEntity)),
      new Set([
        'transactionId',
        'resourceType',
        'resourceId',
        'familyId',
        'childId',
        'cycleId',
        'facts'
      ])
    ) &&
    ['transactionId', 'resourceType', 'resourceId', 'familyId', 'childId', 'cycleId'].every(
      field => typeof committedEntity[field] === 'string' && committedEntity[field].length > 0
    ) &&
    committedEntity.facts &&
    !Array.isArray(committedEntity.facts) &&
    typeof committedEntity.facts === 'object';
  if (!committedEntityShapeValid) {
    errors.push('committedEntity must be the closed projection read from the local transaction');
  }

  let expectedCommittedFacts = null;
  let expectedCommittedResourceId = null;
  switch (incoming.endpointOperation) {
    case 'cycle-create':
      expectedCommittedFacts = { finalizationOutboxCount: 0 };
      expectedCommittedResourceId = committedEntity.cycleId;
      break;
    case 'explanation-job':
    case 'practice-job':
      expectedCommittedFacts = {
        kind: incoming.request?.kind,
        finalizationOutboxCount: 0
      };
      break;
    case 'explanation-artifact-review':
    case 'practice-artifact-review':
      expectedCommittedFacts = {
        artifactId: incoming.request?.artifactId,
        artifactVersion: incoming.request?.artifactVersion,
        decision: incoming.request?.decision,
        finalizationOutboxCount: 0
      };
      expectedCommittedResourceId = incoming.request?.artifactId;
      break;
    case 'correction-start':
    case 'practice-start':
    case 'cycle-cancel':
      expectedCommittedFacts = {
        action: incoming.request?.action,
        finalizationOutboxCount: 0
      };
      expectedCommittedResourceId = incoming.resource?.cycleId;
      break;
    case 'correction-submit':
    case 'practice-submit':
      expectedCommittedFacts = {
        stage: incoming.request?.stage,
        attemptVersion: incoming.request?.attemptVersion,
        finalizationOutboxCount: 0
      };
      expectedCommittedResourceId =
        `${incoming.resource?.cycleId}:${incoming.request?.stage}:${incoming.request?.attemptVersion}`;
      break;
    case 'correction-review':
      expectedCommittedFacts = {
        stage: 'correction',
        attemptVersion: committedEntity.facts?.attemptVersion,
        reviewOperationId: incoming.request?.operationId,
        cycleCurrentAttemptId: committedEntity.facts?.cycleCurrentAttemptId,
        cycleCurrentAttemptVersion:
          committedEntity.facts?.cycleCurrentAttemptVersion,
        decision: incoming.request?.decision,
        finalizationOutboxCount: 0
      };
      if (
        !new RegExp(`^${escapeRegExp(incoming.resource?.cycleId || '')}:correction:[1-9][0-9]*$`).test(committedEntity.resourceId || '') ||
        committedEntity.resourceId !== committedEntity.facts?.cycleCurrentAttemptId ||
        !Number.isInteger(committedEntity.facts?.attemptVersion) ||
        committedEntity.facts.attemptVersion < 1 ||
        committedEntity.facts.attemptVersion !==
          committedEntity.facts?.cycleCurrentAttemptVersion
      ) {
        errors.push('correction-review must bind the transaction-updated current correction Attempt');
      }
      break;
    case 'final-review':
      if (incoming.request?.decision === 'revise') {
        expectedCommittedFacts = {
          stage: 'practice',
          attemptVersion: committedEntity.facts?.attemptVersion,
          reviewOperationId: incoming.request?.operationId,
          cycleCurrentAttemptId: committedEntity.facts?.cycleCurrentAttemptId,
          cycleCurrentAttemptVersion:
            committedEntity.facts?.cycleCurrentAttemptVersion,
          decision: 'revise',
          finalizationOutboxCount: 0
        };
        if (
          !new RegExp(`^${escapeRegExp(incoming.resource?.cycleId || '')}:practice:[1-9][0-9]*$`).test(committedEntity.resourceId || '') ||
          committedEntity.resourceId !== committedEntity.facts?.cycleCurrentAttemptId ||
          !Number.isInteger(committedEntity.facts?.attemptVersion) ||
          committedEntity.facts.attemptVersion < 1 ||
          committedEntity.facts.attemptVersion !==
            committedEntity.facts?.cycleCurrentAttemptVersion
        ) {
          errors.push('final-review revise must bind the transaction-updated current practice Attempt');
        }
      } else if (incoming.request?.decision === 'mastered') {
        expectedCommittedFacts = {
          decision: 'mastered',
          finalizationOutboxCount: 2
        };
        expectedCommittedResourceId = `${incoming.resource?.cycleId}:final-review:1`;
      }
      break;
    default:
      errors.push('committedEntity has no operation-specific binding rule');
  }
  if (
    committedEntityShapeValid &&
    (committedEntity.transactionId !== commitContext.transactionId ||
      committedEntity.resourceType !== responseVariant?.responseResourceType ||
      !isDeepStrictEqual(committedEntity.facts, expectedCommittedFacts) ||
      (expectedCommittedResourceId !== null &&
        committedEntity.resourceId !== expectedCommittedResourceId))
  ) {
    errors.push('committedEntity must match the request-specific result written in the same transaction');
  }

  if (
    !sameSet(
      new Set(Object.keys(actualResult)),
      new Set([
        'httpStatus',
        'resourceType',
        'resourceId',
        'responseId',
        'familyId',
        'childId',
        'cycleId'
      ])
    ) ||
    !Number.isInteger(actualResult.httpStatus) ||
    actualResult.httpStatus < 200 ||
    actualResult.httpStatus > 299 ||
    ['resourceType', 'resourceId', 'responseId', 'familyId', 'childId', 'cycleId'].some(
      field => typeof actualResult[field] !== 'string' || actualResult[field].length === 0
    )
  ) {
    errors.push('actual result projection is invalid');
  }

  if (
    !actorShapeValid ||
    !authorizedResourceShapeValid ||
    actor.accountStatus !== 'active' ||
    incoming.actorFamilyId !== actor.familyId ||
    actor.familyId !== authorizedResource.familyId ||
    actor.familyId !== actualResult.familyId ||
    actor.familyId !== persistedRecord.familyId ||
    !mutationSemantics?.allowedActorRoles.includes(actor.role) ||
    (actor.role === 'parent'
      ? actor.childId !== null || actor.activeParentMembership !== true
      : actor.childId !== authorizedResource.childId ||
        actor.activeParentMembership !== false)
  ) {
    errors.push('persisted record actor and family must match the authorized first caller');
  }
  if (
    authorizedResource.exists !== true ||
    authorizedResource.childId !== actualResult.childId ||
    authorizedResource.childId !== persistedRecord.childId
  ) {
    errors.push('persisted record child must match the authorized resource and actual result');
  }
  if (
    persistedRecord.endpointOperation !== incoming.endpointOperation ||
    persistedRecord.operationId !== incoming.request?.operationId ||
    persistedRecord.requestPayloadHash !== incoming.requestPayloadHash ||
    persistedRecord.createdBy?.userId !== actor.userId ||
    persistedRecord.createdBy?.role !== actor.role
  ) {
    errors.push('persisted record identity, hash and creator must match the first request');
  }

  const actualReference = {
    httpStatus: actualResult.httpStatus,
    resourceType: actualResult.resourceType,
    resourceId: actualResult.resourceId,
    responseId: actualResult.responseId
  };
  const recordWithActualReference = {
    ...persistedRecord,
    responseReference: actualReference
  };
  if (
    !mutationSemantics ||
    !matchesTutorResponseVariant(actualResult, responseVariant) ||
    !committedEntityShapeValid ||
    actualResult.resourceType !== committedEntity.resourceType ||
    actualResult.resourceId !== committedEntity.resourceId ||
    actualResult.familyId !== committedEntity.familyId ||
    actualResult.childId !== committedEntity.childId ||
    actualResult.cycleId !== committedEntity.cycleId ||
    !isDeepStrictEqual(persistedRecord.responseReference, actualReference) ||
    actualResult.responseId !== computeTutorResponseId(recordWithActualReference)
  ) {
    errors.push('persisted responseReference must be the deterministic projection of the actual result');
  }

  if (incoming.endpointOperation === 'cycle-create') {
    if (
      incoming.resource?.cycleId !== null ||
      authorizedResource.cycleId !== null ||
      persistedRecord.resource?.cycleId !== null ||
      actualResult.cycleId !== actualResult.resourceId ||
      committedEntity.cycleId !== committedEntity.resourceId
    ) {
      errors.push('cycle-create commit must bind the authorized source to the newly created Cycle');
    }
  } else if (
    persistedRecord.resource?.cycleId !== incoming.resource?.cycleId ||
    persistedRecord.resource?.cycleId !== authorizedResource.cycleId ||
    persistedRecord.resource?.cycleId !== actualResult.cycleId ||
    persistedRecord.resource?.cycleId !== committedEntity.cycleId
  ) {
    errors.push('persisted record must bind the actual result to the requested authorized Cycle');
  }
  return errors;
}

function generationRequestHashErrors(ajv, value) {
  const errors = [];
  const generationInput = value?.generationInput || {};
  const generationInputSchemaId =
    'https://lms.family.local/schemas/tutor-generation-input-v1.json';
  const generationInputValidator = ajv.getSchema(generationInputSchemaId);
  if (!generationInputValidator || !generationInputValidator(generationInput)) {
    errors.push(
      `generationInput is invalid: ${generationInputValidator?.errors ? ajv.errorsText(generationInputValidator.errors) : 'schema unavailable'}`
    );
  }
  errors.push(...customContractErrors(generationInputSchemaId, generationInput));
  if (value.requestHash !== computeGenerationRequestHash(generationInput)) {
    errors.push('requestHash must match the canonical deterministic generation input');
  }
  return errors;
}

function buildContractValidators(contractDocuments, errors) {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    strictRequired: false,
    allowUnionTypes: true
  });
  addFormats(ajv);

  for (const [relativePath, document] of contractDocuments) {
    if (!document.$schema) {
      continue;
    }
    try {
      ajv.addSchema(document);
    } catch (error) {
      errors.push(`${relativePath}: JSON Schema registration failed: ${error.message}`);
    }
  }

  for (const [relativePath, document] of contractDocuments) {
    if (!document.$schema || !document.$id) {
      continue;
    }
    try {
      assert(
        Boolean(ajv.getSchema(document.$id)),
        `${relativePath}: JSON Schema did not compile`,
        errors
      );
    } catch (error) {
      errors.push(`${relativePath}: JSON Schema compilation failed: ${error.message}`);
    }
  }

  return ajv;
}

function validateContractFixtures(ajv, errors) {
  const absoluteDirectory = path.join(repositoryRoot, contractFixtureDirectory);
  assert(
    fs.existsSync(absoluteDirectory),
    `${contractFixtureDirectory}: fixture directory is missing`,
    errors
  );
  if (!fs.existsSync(absoluteDirectory)) {
    return 0;
  }

  const fixtureFiles = fs
    .readdirSync(absoluteDirectory)
    .filter(fileName => fileName.endsWith('.cases.json'))
    .sort();
  for (const requiredFixture of [
    'tutor-finalization-batch.cases.json',
    'tutor-artifact-review-cas.cases.json',
    'tutor-artifact-review-request.cases.json',
    'tutor-correction-review-request.cases.json',
    'tutor-cycle-create-request.cases.json',
    'tutor-cycle-create-consistency.cases.json',
    'tutor-cycle-attempt.cases.json',
    'tutor-cycle-attempt-transition.cases.json',
    'tutor-generation-input.cases.json',
    'tutor-generation-job-request.cases.json',
    'tutor-idempotency-decision.cases.json',
    'tutor-idempotency-first-write.cases.json',
    'tutor-idempotency-record-commit.cases.json',
    'tutor-idempotency-record.cases.json',
    'tutor-learning-cycle.cases.json',
    'tutor-learning-cycle-transition.cases.json',
    'tutor-request-payload-hash.cases.json',
    'tutor-generation-request-hash.cases.json',
    'tutor-stage-action-request.cases.json',
    'tutor-stage-submission-request.cases.json',
    'tutor-final-review-request.cases.json',
    'tutor-final-review-snapshot.cases.json'
  ]) {
    assert(
      fixtureFiles.includes(requiredFixture),
      `${contractFixtureDirectory}: required fixture ${requiredFixture} is missing`,
      errors
    );
  }
  let caseCount = 0;

  for (const fileName of fixtureFiles) {
    const relativePath = path.join(contractFixtureDirectory, fileName);
    const suite = loadJson(relativePath, errors);
    const validateSchema = suite.schemaId ? ajv.getSchema(suite.schemaId) : null;
    const isFinalizationBatch = suite.validator === 'tutor-finalization-batch-v1';
    const isArtifactReviewCas = suite.validator === 'tutor-artifact-review-cas-v1';
    const isCycleCreateConsistency =
      suite.validator === 'tutor-cycle-create-consistency-v1';
    const isCycleTransition =
      suite.validator === 'tutor-learning-cycle-transition-v1';
    const isCycleReviewTransaction =
      suite.validator === 'tutor-cycle-review-transaction-v1';
    const isRequestPayloadHash = suite.validator === 'tutor-request-payload-hash-v1';
    const isIdempotencyDecision =
      suite.validator === 'tutor-idempotency-decision-v1';
    const isIdempotencyFirstWrite =
      suite.validator === 'tutor-idempotency-first-write-v1';
    const isIdempotencyRecordCommit =
      suite.validator === 'tutor-idempotency-record-commit-v1';
    const isGenerationRequestHash =
      suite.validator === 'tutor-generation-request-hash-v1';
    assert(
      Boolean(validateSchema) ||
        isFinalizationBatch ||
        isArtifactReviewCas ||
        isCycleCreateConsistency ||
        isCycleTransition ||
        isCycleReviewTransaction ||
        isRequestPayloadHash ||
        isIdempotencyDecision ||
        isIdempotencyFirstWrite ||
        isIdempotencyRecordCommit ||
        isGenerationRequestHash,
      `${relativePath}: unknown schemaId or validator ${suite.schemaId || suite.validator}`,
      errors
    );
    if (
      !validateSchema &&
      !isFinalizationBatch &&
      !isArtifactReviewCas &&
      !isCycleCreateConsistency &&
      !isCycleTransition &&
      !isCycleReviewTransaction &&
      !isRequestPayloadHash &&
      !isIdempotencyDecision &&
      !isIdempotencyFirstWrite &&
      !isIdempotencyRecordCommit &&
      !isGenerationRequestHash
    ) {
      continue;
    }

    for (const [expectedValid, cases] of [
      [true, suite.valid],
      [false, suite.invalid]
    ]) {
      assert(Array.isArray(cases), `${relativePath}: fixture cases must be arrays`, errors);
      for (const fixtureCase of Array.isArray(cases) ? cases : []) {
        caseCount += 1;
        const preset = fixtureCase.preset ? suite.presets?.[fixtureCase.preset] : null;
        assert(
          !fixtureCase.preset || preset,
          `${relativePath}: fixture ${fixtureCase.name} references unknown preset ${fixtureCase.preset}`,
          errors
        );
        const fixtureBase = preset ? applyFixtureSet(suite.base, preset) : suite.base;
        const value = applyFixtureSet(fixtureBase, fixtureCase.set);
        if (fixtureCase.hashMustMatch && isGenerationRequestHash) {
          assert(
            value.requestHash === computeGenerationRequestHash(value.generationInput),
            `${relativePath}: ${fixtureCase.name} must carry a correct generation hash`,
            errors
          );
        }
        if (fixtureCase.hashMustMatch && isRequestPayloadHash) {
          assert(
            value.requestPayloadHash ===
              computeRequestPayloadHash(
                value.endpointOperation,
                value.resource,
                value.request
              ),
            `${relativePath}: ${fixtureCase.name} must carry a correct public request hash`,
            errors
          );
        }
        const schemaValid = validateSchema ? validateSchema(value) : true;
        const semanticErrors = isFinalizationBatch
          ? finalizationBatchErrors(ajv, value)
          : isArtifactReviewCas
            ? artifactReviewCasErrors(ajv, value)
            : isCycleCreateConsistency
              ? cycleCreateConsistencyErrors(ajv, value)
              : isCycleTransition
                ? cycleTransitionErrors(ajv, value)
                : isCycleReviewTransaction
                  ? cycleReviewTransactionErrors(ajv, value)
                : isRequestPayloadHash
                  ? requestPayloadHashErrors(ajv, value)
                  : isIdempotencyDecision
                    ? idempotencyDecisionErrors(ajv, value)
                  : isIdempotencyFirstWrite
                    ? idempotencyFirstWriteErrors(value)
                  : isIdempotencyRecordCommit
                    ? idempotencyRecordCommitErrors(ajv, value)
                  : isGenerationRequestHash
                    ? generationRequestHashErrors(ajv, value)
            : customContractErrors(suite.schemaId, value);
        const actualValid = schemaValid && semanticErrors.length === 0;
        if (actualValid !== expectedValid) {
          const validationDetails = [
            validateSchema?.errors
              ? ajv.errorsText(validateSchema.errors, { separator: '; ' })
              : '',
            ...semanticErrors
          ]
            .filter(Boolean)
            .join('; ');
          errors.push(
            `${relativePath}: ${fixtureCase.name} expected ${
              expectedValid ? 'valid' : 'invalid'
            }, got ${actualValid ? 'valid' : 'invalid'}${
              validationDetails ? ` (${validationDetails})` : ''
            }`
          );
        }
      }
    }

  }

  return caseCount;
}

function validate() {
  const errors = [];
  const documents = new Map();
  const aiDocuments = new Map();
  const selfDirectedDocuments = new Map();

  for (const relativePath of authoritativeDocuments) {
    const absolutePath = path.join(repositoryRoot, relativePath);
    assert(fs.existsSync(absolutePath), `${relativePath}: file is missing`, errors);
    if (fs.existsSync(absolutePath)) {
      documents.set(relativePath, read(relativePath));
    }
  }

  for (const [relativePath, markdown] of documents) {
    checkLocalLinks(relativePath, markdown, errors);
    assert(
      !/\b(?:TODO|TBD|FIXME|PLANNED_TASK_5_PLUS)\b/.test(markdown),
      `${relativePath}: unresolved placeholder marker`,
      errors
    );
  }

  for (const relativePath of proposedAiDocuments) {
    const absolutePath = path.join(repositoryRoot, relativePath);
    assert(fs.existsSync(absolutePath), `${relativePath}: file is missing`, errors);
    if (fs.existsSync(absolutePath)) {
      aiDocuments.set(relativePath, read(relativePath));
    }
  }

  for (const [relativePath, markdown] of aiDocuments) {
    checkLocalLinks(relativePath, markdown, errors);
    checkMarkdownStructure(relativePath, markdown, errors);
    assert(
      !/\b(?:TODO|TBD|FIXME)\b/.test(markdown),
      `${relativePath}: unresolved placeholder marker`,
      errors
    );
  }

  for (const relativePath of proposedSelfDirectedDocuments) {
    const absolutePath = path.join(repositoryRoot, relativePath);
    assert(fs.existsSync(absolutePath), `${relativePath}: file is missing`, errors);
    if (fs.existsSync(absolutePath)) {
      selfDirectedDocuments.set(relativePath, read(relativePath));
    }
  }

  for (const [relativePath, markdown] of selfDirectedDocuments) {
    checkLocalLinks(relativePath, markdown, errors);
    checkMarkdownStructure(relativePath, markdown, errors);
    assert(
      !/\b(?:TODO|TBD|FIXME)\b/.test(markdown),
      `${relativePath}: unresolved placeholder marker`,
      errors
    );
  }

  const contractDocuments = new Map();
  for (const relativePath of proposedAiContracts) {
    contractDocuments.set(relativePath, loadJson(relativePath, errors));
  }
  const ajv = buildContractValidators(contractDocuments, errors);
  const contractFixtureCases = validateContractFixtures(ajv, errors);

  const aiDesign =
    aiDocuments.get('docs/architecture/family-ai-learning-platform-design.md') || '';
  const thinkPadIndex =
    aiDocuments.get('docs/ThinkPad_DeepTutor_K12_部署手册/00_总目录与实施路线.md') || '';
  const deepTutorDeployment =
    aiDocuments.get('docs/ThinkPad_DeepTutor_K12_部署手册/02_Ubuntu_Docker_DeepTutor安装.md') || '';
  const k12Deployment =
    aiDocuments.get('docs/ThinkPad_DeepTutor_K12_部署手册/04_K12数据部署及教材扩展.md') || '';
  const aiIntegration =
    aiDocuments.get('docs/ThinkPad_DeepTutor_K12_部署手册/05_DeepTutor与K12集成设计.md') || '';

  assert(
    aiDesign.includes('**Document status:** DRAFT FOR REVIEW'),
    'AI platform design must remain DRAFT FOR REVIEW until implementation approval',
    errors
  );
  assert(
    thinkPadIndex.includes('DeepTutor、') && thinkPadIndex.includes('K12-KGraph 属于拟议扩展'),
    'ThinkPad index must identify DeepTutor/K12 as a proposed extension',
    errors
  );

  for (const manualPath of proposedAiDocuments.slice(2)) {
    const fileName = path.basename(manualPath);
    assert(
      thinkPadIndex.includes(fileName),
      `ThinkPad index is missing ${fileName}`,
      errors
    );
  }

  const curriculumRefSchema =
    contractDocuments.get('docs/contracts/curriculum-ref.schema.json') || {};
  const errorClassificationSchema =
    contractDocuments.get('docs/contracts/error-classification.schema.json') || {};
  const tutorGenerationInputSchema =
    contractDocuments.get('docs/contracts/tutor-generation-input.schema.json') || {};
  const tutorArtifactSchema =
    contractDocuments.get('docs/contracts/tutor-artifact.schema.json') || {};
  const tutorCycleAttemptSchema =
    contractDocuments.get('docs/contracts/tutor-cycle-attempt.schema.json') || {};
  const correctionReviewRequestSchema =
    contractDocuments.get('docs/contracts/tutor-correction-review-request.schema.json') || {};
  const tutorCycleStateMachine =
    contractDocuments.get('docs/contracts/tutor-cycle-state-machine.json') || {};
  const tutorLearningCycleSchema =
    contractDocuments.get('docs/contracts/tutor-learning-cycle.schema.json') || {};
  const tutorGenerationJobRequestSchema =
    contractDocuments.get('docs/contracts/tutor-generation-job-request.schema.json') || {};
  const tutorStageActionRequestSchema =
    contractDocuments.get('docs/contracts/tutor-stage-action-request.schema.json') || {};
  const tutorStageSubmissionRequestSchema =
    contractDocuments.get('docs/contracts/tutor-stage-submission-request.schema.json') || {};
  const finalReviewRequestSchema =
    contractDocuments.get('docs/contracts/tutor-final-review-request.schema.json') || {};
  const finalReviewSnapshotSchema =
    contractDocuments.get('docs/contracts/tutor-final-review-snapshot.schema.json') || {};
  const tutorIdempotencyRecordSchema =
    contractDocuments.get('docs/contracts/tutor-idempotency-record.schema.json') || {};
  const finalizationCommandSchema =
    contractDocuments.get('docs/contracts/tutor-finalization-command.schema.json') || {};

  assert(
    curriculumRefSchema.properties?.schemaVersion?.const === 'curriculum-ref-v1',
    'CurriculumRef contract must be curriculum-ref-v1',
    errors
  );
  for (const field of [
    'source',
    'datasetVersion',
    'nodeId',
    'mappingStatus',
    'mappingSource',
    'textbookScope',
    'evidenceSnapshot'
  ]) {
    assert(
      curriculumRefSchema.required?.includes(field),
      `CurriculumRef contract is missing required field ${field}`,
      errors
    );
  }
  for (const field of ['reviewedByParentId', 'reviewedAt']) {
    assert(
      curriculumRefSchema.required?.includes(field),
      `CurriculumRef contract is missing audit field ${field}`,
      errors
    );
  }

  const canonicalReasonCodes = new Set([
    'concept_gap',
    'formula_selection',
    'condition_omitted',
    'calculation',
    'unit_conversion',
    'method_or_process',
    'application',
    'reading_or_interpretation',
    'careless',
    'unknown'
  ]);
  assert(
    sameSet(
      new Set(errorClassificationSchema.$defs?.reasonCode?.enum || []),
      canonicalReasonCodes
    ),
    'ErrorClassification reason codes differ from the canonical v1 set',
    errors
  );
  assert(
    errorClassificationSchema.properties?.primaryReasonCode &&
      errorClassificationSchema.properties?.secondaryReasonCodes,
    'ErrorClassification must define one primary and optional secondary reasons',
    errors
  );
  assert(
    sameSet(
      new Set(tutorGenerationInputSchema.$defs?.reasonCode?.enum || []),
      canonicalReasonCodes
    ),
    'TutorGenerationInput must reuse the canonical reason-code vocabulary',
    errors
  );
  for (const nestedDefinition of [
    'sourceMistakeSnapshot',
    'confirmedErrorSnapshot',
    'generationCurriculumSnapshot',
    'explanationPolicy',
    'practicePolicy'
  ]) {
    assert(
      tutorGenerationInputSchema.$defs?.[nestedDefinition]?.additionalProperties === false,
      `TutorGenerationInput ${nestedDefinition} must use a closed field allowlist`,
      errors
    );
  }

  assert(
    tutorCycleAttemptSchema.required?.includes('review') &&
      tutorCycleAttemptSchema.properties?.review,
    'TutorCycleAttempt must explicitly represent an unreviewed or once-reviewed attempt',
    errors
  );
  assert(
    sameSet(
      new Set(tutorCycleAttemptSchema.properties?.stage?.enum || []),
      new Set(['correction', 'practice'])
    ),
    'TutorCycleAttempt stage must be correction or practice',
    errors
  );
  assert(
    tutorGenerationJobRequestSchema.additionalProperties === false &&
      tutorStageActionRequestSchema.additionalProperties === false &&
      tutorStageSubmissionRequestSchema.additionalProperties === false,
    'All shared tutor mutation requests must reject extra fields',
    errors
  );

  const artifactStatuses = new Set(tutorArtifactSchema.properties?.status?.enum || []);
  assert(
    sameSet(
      artifactStatuses,
      new Set(['candidate', 'parent_approved', 'rejected'])
    ),
    'TutorArtifact status set is inconsistent',
    errors
  );
  assert(
    sameSet(
      new Set(correctionReviewRequestSchema.properties?.decision?.enum || []),
      new Set(['approve', 'revise'])
    ),
    'Correction review decision must be approve or revise',
    errors
  );
  assert(
    sameSet(
      new Set(finalReviewRequestSchema.properties?.decision?.enum || []),
      new Set(['mastered', 'revise'])
    ),
    'Final review request decision must be mastered or revise',
    errors
  );
  assert(
    finalReviewSnapshotSchema.properties?.decision?.const === 'mastered',
    'MVP persisted final review decision must be mastered',
    errors
  );

  const cycleStates = tutorCycleStateMachine.states || {};
  const publicMutations = tutorCycleStateMachine.publicMutations || [];
  assert(
    sameSet(
      new Set(publicMutations.map(mutation => mutation.endpointOperation)),
      new Set(tutorMutationSemantics.keys())
    ),
    'Tutor public mutation semantics must cover every endpointOperation exactly once',
    errors
  );
  assert(
    sameSet(
      new Set(tutorIdempotencyRecordSchema.properties?.endpointOperation?.enum || []),
      new Set(publicMutations.map(mutation => mutation.endpointOperation))
    ),
    'TutorIdempotencyRecord endpointOperation enum must match public Tutor mutations',
    errors
  );
  const schemaByEndpointOperation = new Map();
  for (const mutation of publicMutations) {
    const mutationSemantics = tutorMutationSemantics.get(mutation.endpointOperation);
    assert(
      mutationSemantics &&
        sameSet(
          new Set(mutation.allowedActorRoles || []),
          new Set(mutationSemantics.allowedActorRoles)
        ),
      `Tutor public mutation ${mutation.endpointOperation} has inconsistent allowedActorRoles`,
      errors
    );
    assert(
      isDeepStrictEqual(
        mutation.responseVariants,
        mutationSemantics?.responseVariants
      ),
      `Tutor public mutation ${mutation.endpointOperation} has inconsistent responseVariants`,
      errors
    );
    assert(
      /^POST \/api\/tutor(?:-|\/)/.test(mutation.route || ''),
      `Tutor public mutation has invalid route ${mutation.route}`,
      errors
    );
    assert(
      Boolean(ajv.getSchema(mutation.requestSchemaId)),
      `Tutor public mutation ${mutation.endpointOperation} has unavailable request schema`,
      errors
    );
    const existingSchemaId = schemaByEndpointOperation.get(mutation.endpointOperation);
    assert(
      !existingSchemaId,
      `Tutor endpointOperation ${mutation.endpointOperation} must identify exactly one public route`,
      errors
    );
    schemaByEndpointOperation.set(mutation.endpointOperation, mutation.requestSchemaId);
  }
  const normalizeTutorRoute = route => route.replace('/{id}/', '/:cycleId/');
  const documentedTutorMutationRoutes = new Set(
    [...aiDesign.matchAll(/^POST (\/api\/tutor[^\s]*)$/gm)].map(match =>
      `POST ${normalizeTutorRoute(match[1])}`
    )
  );
  assert(
    sameSet(
      documentedTutorMutationRoutes,
      new Set(publicMutations.map(mutation => mutation.route))
    ),
    'Public Tutor POST routes must match the state-machine mutation contract manifest',
    errors
  );
  const requestHashFixture = loadJson(
    'docs/contracts/fixtures/tutor-request-payload-hash.cases.json',
    errors
  );
  const requestHashFixtureRoutes = new Set(
    (requestHashFixture.valid || []).map(fixtureCase => {
      const preset = fixtureCase.preset
        ? requestHashFixture.presets?.[fixtureCase.preset]
        : null;
      const fixtureBase = preset
        ? applyFixtureSet(requestHashFixture.base, preset)
        : requestHashFixture.base;
      const value = applyFixtureSet(fixtureBase, fixtureCase.set);
      return `${value.route}|${value.endpointOperation}`;
    })
  );
  assert(
    sameSet(
      requestHashFixtureRoutes,
      new Set(
        publicMutations.map(
          mutation => `${mutation.route}|${mutation.endpointOperation}`
        )
      )
    ),
    'requestPayloadHash fixtures must cover every public Tutor mutation route and operation',
    errors
  );
  assert(
    sameSet(
      new Set(tutorLearningCycleSchema.$defs?.status?.enum || []),
      new Set(Object.keys(cycleStates))
    ),
    'TutorLearningCycle status enum must match the state machine exactly',
    errors
  );
  for (const state of [
    'explanation_pending_review',
    'explanation_approved',
    'explanation_rejected',
    'practice_pending_review',
    'practice_approved',
    'practice_rejected',
    'parent_verified',
    'closed'
  ]) {
    assert(Object.hasOwn(cycleStates, state), `Tutor cycle state machine is missing ${state}`, errors);
  }
  assert(
    cycleStates.explanation_pending_review?.includes('explanation_approved') &&
      !cycleStates.explanation_pending_review?.includes('correction_in_progress'),
    'Explanation candidate must pass explicit parent approval before correction',
    errors
  );
  assert(
    cycleStates.practice_pending_review?.includes('practice_approved') &&
      !cycleStates.practice_pending_review?.includes('practice_in_progress'),
    'Practice candidate must pass explicit parent approval before child practice',
    errors
  );
  assert(
    sameSet(
      new Set(cycleStates.practice_submitted || []),
      new Set(['practice_needs_revision', 'parent_verified', 'cancelled'])
    ) && sameSet(new Set(cycleStates.parent_verified || []), new Set(['closed'])),
    'Final review must be accepted once from practice_submitted, then only close',
    errors
  );
  assert(
    isDeepStrictEqual(tutorCycleStateMachine.reviewTransitions?.['correction-review'], {
      requestSchemaVersion: 'tutor-correction-review-request-v1',
      from: 'correction_submitted',
      decisions: {
        approve: 'correction_approved',
        revise: 'correction_needs_revision'
      }
    }),
    'Correction review decisions must map to the matching cycle states',
    errors
  );
  assert(
    isDeepStrictEqual(tutorCycleStateMachine.reviewTransitions?.['final-review'], {
      requestSchemaVersion: 'tutor-final-review-request-v1',
      from: 'practice_submitted',
      decisions: {
        mastered: 'parent_verified',
        revise: 'practice_needs_revision'
      }
    }),
    'Final review decisions must map to the matching cycle states',
    errors
  );
  for (const [state, targets] of Object.entries(cycleStates)) {
    assert(Array.isArray(targets), `Tutor cycle state ${state} transitions must be an array`, errors);
    for (const target of Array.isArray(targets) ? targets : []) {
      assert(
        Object.hasOwn(cycleStates, target),
        `Tutor cycle state ${state} points to unknown state ${target}`,
        errors
      );
    }
  }
  const reachableStates = new Set();
  const pendingStates = [tutorCycleStateMachine.initialState];
  while (pendingStates.length > 0) {
    const state = pendingStates.pop();
    if (!state || reachableStates.has(state)) {
      continue;
    }
    reachableStates.add(state);
    pendingStates.push(...(cycleStates[state] || []));
  }
  assert(
    sameSet(reachableStates, new Set(Object.keys(cycleStates))),
    'Tutor cycle state machine contains a state unreachable from its initial state',
    errors
  );
  for (const terminalState of tutorCycleStateMachine.terminalStates || []) {
    assert(
      Array.isArray(cycleStates[terminalState]) && cycleStates[terminalState].length === 0,
      `Tutor cycle terminal state ${terminalState} must not have outgoing transitions`,
      errors
    );
  }

  for (const field of [
    'target',
    'operationId',
    'payloadHash',
    'status',
    'attemptCount',
    'nextAttemptAt',
    'leaseOwner',
    'leaseExpiresAt',
    'responseId'
  ]) {
    assert(
      finalizationCommandSchema.required?.includes(field),
      `TutorFinalizationCommand contract is missing required field ${field}`,
      errors
    );
  }
  assert(
    finalizationCommandSchema.properties?.finalReviewVersion?.const === 1,
    'TutorFinalizationCommand MVP finalReviewVersion must be immutable version 1',
    errors
  );

  const contentSchemaIds = new Map([
    ['explanation-v1', 'https://lms.family.local/schemas/explanation-content-v1.json'],
    ['practice-v1', 'https://lms.family.local/schemas/practice-content-v1.json']
  ]);
  let validatedContentExamples = 0;
  for (const [index, block] of fencedBlocks(aiDesign, 'json').entries()) {
    let value;
    try {
      value = JSON.parse(block);
    } catch {
      continue;
    }
    const schemaId = contentSchemaIds.get(value.schemaVersion);
    if (!schemaId) {
      continue;
    }
    validatedContentExamples += 1;
    const validateSchema = ajv.getSchema(schemaId);
    const schemaValid = validateSchema ? validateSchema(value) : false;
    const semanticErrors = customContractErrors(schemaId, value);
    assert(
      schemaValid && semanticErrors.length === 0,
      `AI platform design JSON example ${index + 1} violates ${value.schemaVersion}: ${[
        validateSchema?.errors
          ? ajv.errorsText(validateSchema.errors, { separator: '; ' })
          : 'schema unavailable',
        ...semanticErrors
      ]
        .filter(Boolean)
        .join('; ')}`,
      errors
    );
  }
  assert(
    validatedContentExamples === 2,
    `AI platform design has ${validatedContentExamples} validated content examples, expected 2`,
    errors
  );
  assert(
    contractFixtureCases >= 25,
    `AI contract fixture coverage has ${contractFixtureCases} cases, expected at least 25`,
    errors
  );

  for (const contractPath of proposedAiContracts) {
    assert(
      aiDesign.includes(path.basename(contractPath)),
      `AI platform design does not reference ${path.basename(contractPath)}`,
      errors
    );
  }

  for (const obsoleteText of [
    'explanation_ready',
    'practice_ready',
    'start_turn(operationId)',
    '"errorTypes"',
    '"provider": "k12-kgraph"',
    '家长提交新的审核版本',
    'expectedReviewVersion',
    'finalDecision',
    'needs_review',
    'superseded'
  ]) {
    assert(
      !aiDesign.includes(obsoleteText) && !aiIntegration.includes(obsoleteText),
      `AI draft contains obsolete contract text: ${obsoleteText}`,
      errors
    );
  }

  for (const requiredText of [
    '/explanation-review',
    '/practice-review',
    'artifactId + artifactVersion',
    'parent_approved',
    'uncertain_manual_reconcile',
    'TutorFinalizationCommand',
    'leaseExpiresAt',
    'dead_letter',
    'FINAL_REVIEW_ALREADY_ACCEPTED',
    'TutorFinalReviewSnapshot',
    'finalReviewHash',
    'expectedArtifactReviewVersion',
    'expectedStateVersion',
    'presentedByGrowthTaskId',
    'activeSourceMistakeKey',
    'ACTIVE_TUTOR_CYCLE_EXISTS',
    'RFC8785-JCS',
    'requestPayloadHash',
    'tutor-generation-input-v1',
    'unique(cycleId, kind, version)',
    'unique(cycleId, finalReviewVersion, target)',
    'unique(operationId)',
    '{ familyId: 1, stage: 1, submissionOperationId: 1 }',
    '{ familyId: 1, stage: 1, "review.reviewOperationId": 1 }'
  ]) {
    assert(aiDesign.includes(requiredText), `AI platform design is missing ${requiredText}`, errors);
  }

  for (const requiredText of [
    'admin-validation',
    'lms-integration',
    '"enabled": true',
    'lms-adapter',
    'mcp_tools=[]',
    'exec_enabled=false',
    'compose.admin-validation.yaml',
    'uncertain_manual_reconcile',
    '/srv/edu-stack/secrets',
    'chmod 0600',
    '/run/secrets/deeptutor_adapter_password'
  ]) {
    assert(
      deepTutorDeployment.includes(requiredText) || aiIntegration.includes(requiredText),
      `DeepTutor deployment/integration docs are missing ${requiredText}`,
      errors
    );
  }

  const k12Commit = '8716b6a80850790f509c01286f43e5bfe6858f49';
  const k12RequirementsHash =
    '2c62bda639afa971e160914febe789f588ca1ccb0c85460d2e0b72f98d5215a0';
  const k12DatasetRevision = 'd8522c2b336ee435aa51daa39ca0dd736f56fa53';
  for (const requiredText of [k12Commit, k12RequirementsHash, k12DatasetRevision]) {
    assert(k12Deployment.includes(requiredText), `K12 deployment is missing pin ${requiredText}`, errors);
  }
  assert(
    k12Deployment.indexOf('git checkout --detach "$K12_COMMIT"') <
      k12Deployment.indexOf('python -m pip install -r requirements.txt'),
    'K12 deployment must checkout the reviewed commit before installing dependencies',
    errors
  );

  const product = documents.get('docs/product/family-learning-tracker.md') || '';
  const architecture =
    documents.get('docs/architecture/family-learning-tracker-architecture.md') || '';
  const api = documents.get('docs/api/family-learning-tracker-api.md') || '';
  const repositoryReadme = documents.get('README.md') || '';
  const documentationReadme = documents.get('docs/README.md') || '';
  const developmentReadme = documents.get('docs/development/README.md') || '';
  const traceability =
    documents.get('docs/development/family-growth-requirement-traceability.md') || '';
  const designIndex =
    documents.get('docs/development/family-growth-design-asset-index.md') || '';
  const manifest =
    documents.get('docs/development/family-growth-baseline-v1.6-manifest.md') || '';
  const releaseGate =
    documents.get('docs/development/family-growth-v1.6-release-gate.md') || '';
  const attachmentGate =
    documents.get('docs/development/family-growth-mistake-pdf-multi-attachments-gate.md') || '';
  const deployment = documents.get('docs/deployment/README.md') || '';
  const ubuntuDeployment =
    documents.get('docs/deployment/local-ubuntu-deployment.md') || '';
  const userGuide = documents.get('docs/user-guide/README.md') || '';
  const quickStart = documents.get('docs/user-guide/quick-start.md') || '';
  const parentGuide = documents.get('docs/user-guide/parent-guide.md') || '';
  const childGuide = documents.get('docs/user-guide/child-guide.md') || '';
  const selfDirectedResearch =
    selfDirectedDocuments.get(
      'docs/research/family-self-directed-learning-theory-and-program.md'
    ) || '';
  const selfDirectedDesign =
    selfDirectedDocuments.get(
      'docs/architecture/family-self-directed-learning-system-design.md'
    ) || '';
  const selfDirectedPlan =
    selfDirectedDocuments.get(
      'docs/superpowers/plans/2026-10-21-family-self-directed-learning-mvp.md'
    ) || '';
  const selfDirectedGate =
    selfDirectedDocuments.get(
      'docs/development/family-self-directed-learning-mvp-gate.md'
    ) || '';
  const ubuntuEnvironment = read('docker-compose.ubuntu.env.example');
  const ubuntuCompose = read('docker-compose.ubuntu.yml');

  for (const [relativePath, markdown] of [
    ['docs/product/family-learning-tracker.md', product],
    ['docs/architecture/family-learning-tracker-architecture.md', architecture],
    ['docs/api/family-learning-tracker-api.md', api]
  ]) {
    assert(
      markdown.includes('**Baseline candidate:** FGT-MVP-1.7'),
      `${relativePath}: baseline candidate must be FGT-MVP-1.7`,
      errors
    );
  }

  for (const requiredText of [
    '家庭成长跟踪',
    '德智体美劳',
    'npm run docker:family',
    'npm run release:family',
    './docs/README.md'
  ]) {
    assert(
      repositoryReadme.includes(requiredText),
      `README.md is missing ${requiredText}`,
      errors
    );
  }


  const plannedSelfDirectedRequirements = [
    'SL-01',
    'SL-02',
    'SL-03',
    'SL-04',
    'SL-05',
    'SL-06',
    'SL-07'
  ];
  for (const requirement of plannedSelfDirectedRequirements) {
    for (const [name, markdown] of [
      ['PRD', product],
      ['architecture', architecture],
      ['API', api],
      ['traceability', traceability],
      ['self-directed Gate', selfDirectedGate]
    ]) {
      assert(
        markdown.includes(requirement),
        `${name} is missing planned autonomous-learning requirement ${requirement}`,
        errors
      );
    }
    assert(
      new RegExp('\\| `' + requirement + '` \\|[^\\n]+\\| PLANNED \\|').test(traceability),
      `traceability must keep ${requirement} in a PLANNED row`,
      errors
    );
    assert(
      new RegExp('\\| `' + requirement + '` \\|[^\\n]+\\| PLANNED \\|').test(selfDirectedGate),
      `self-directed Gate must keep ${requirement} in a PLANNED row`,
      errors
    );
  }

  // Only the current status table counts; historical OPEN records remain immutable.
  const taskStatusTable = boundedSection(selfDirectedGate, '## 3. T0 至 T9 执行状态', '## 4. 固定接口和并发语义');
  const taskStatusRows = taskStatusTable.split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('|'))
    .map(line => line.split('|').map(cell => cell.trim()));
  for (const task of Array.from({ length: 10 }, (_, index) => `T${index}`)) {
    assert(selfDirectedPlan.includes(`### ${task}：`), `self-directed plan is missing ${task}`, errors);
    assert(taskStatusRows.some(cells => cells[1] === task), `self-directed Gate is missing ${task}`, errors);
  }
  assert(
    selfDirectedGate.includes('| T0 | CONTRACT_BASELINE |'),
    'self-directed Gate must record T0 as CONTRACT_BASELINE',
    errors
  );
  const t1Rows = taskStatusTable.match(/^\| T1 \|.*$/gm) || [];
  assert(t1Rows.length === 1 && t1Rows[0].startsWith('| T1 | CLOSED |'),
    'self-directed Gate must have exactly one CLOSED T1 row in the current status table', errors);
  const gateHeader = selfDirectedGate.split('\n## ')[0];
  for (const [key, value, message] of [
    ['T1 closure scope', 'BACKEND_SYNTHETIC_ONLY', 'closure scope must remain BACKEND_SYNTHETIC_ONLY'],
    ['Production deployment', 'NOT_AUTHORIZED', 'production deployment must remain NOT_AUTHORIZED']
  ]) {
    const lines = gateHeader.split('\n').filter(line => line.startsWith(`**${key}:**`));
    assert(lines.length === 1 && lines[0] === `**${key}:** ${value}`, message, errors);
  }
  const reconciliation = read('docs/development/family-self-directed-learning-t1-acceptance-reconciliation.md');
  const reconciliationHeader = reconciliation.split('\n## ')[0];
  for (const task of ['T1', 'R4']) {
    const lines = reconciliationHeader.split('\n').filter(line => line.startsWith(`**${task}:**`));
    assert(lines.length === 1 && lines[0] === `**${task}:** CLOSED`,
      `reconciliation ${task} must be CLOSED`, errors);
  }
  for (const [document, marker, message] of [
    [selfDirectedPlan, '> 状态：执行中（T0 已完成，T1 后端工程已关闭，T2 合成工程已关闭，T3 合成工程已关闭，T4 实施中，T5-T9 待执行）', 'approved T1 plan status and bounded T2/T3 closure'],
    [selfDirectedPlan, '- [x] R4 入口验收及 T1 关闭：CLOSED', 'approved R4 plan checkbox'],
    [reconciliation, '| R4 正式入口验收及 T1 关闭 | CLOSED |', 'approved R4 reconciliation row'],
    [read('docs/development/README.md'), '## 自主学习 MVP 增量计划（T0 已关闭，T1 后端工程已关闭，T2 合成工程已关闭，T3 合成工程已关闭，T4 实施中，T5-T9 待执行）', 'navigation must reflect T1 backend closure and bounded T2/T3 closure'],
    [read('docs/deployment/completion-operations.md'), '**Status:** CLOSED（R1–R4 及 T1 后端工程总门禁', 'operations must reflect T1 backend closure']
  ]) {
    assert(document.includes(marker), message, errors);
  }
  for (const marker of ['| R3-LEARNING | CLOSED |', '| R3 门禁 P2 | CLOSED |', '| T0 | APPROVED / CLOSED |']) {
    assert(selfDirectedGate.includes(marker), `self-directed Gate is missing approved closure ${marker}`, errors);
  }
  const t2Rows = taskStatusRows.filter(cells => cells[1] === 'T2');
  assert(t2Rows.length === 1 && t2Rows[0][2] === 'CLOSED',
    'self-directed Gate must have exactly one CLOSED T2 row in the current status table', errors);
  for (const [key, value] of [
    ['T2 closure scope', 'ENGINEERING_SYNTHETIC_ONLY'],
    ['T2 approval', 'APPROVED'],
    ['T2 approval-time full regression', 'FAILED / D2B-05 / REMAINDER_DEFERRED'],
    ['T2 latest full regression', 'PASSED / CI 40099315976 / e744cba1'],
    ['D2B-05 query timeout', 'APPROVED / CLOSED / QUERY_ONLY'],
    ['T2 device', 'DEVICE_PENDING'],
    ['T2 deployment', 'T8_PENDING / NOT_AUTHORIZED'],
    ['T2 deferred', 'REMAINDER_DEFERRED']
  ]) {
    const lines = gateHeader.split('\n').filter(line => line.startsWith(`**${key}:**`));
    assert(lines.length === 1 && lines[0] === `**${key}:** ${value}`,
      `${key} must remain ${value}`, errors);
  }
  const t2Execution = read('docs/development/family-self-directed-learning-t2-execution.md');
  const t2ExecutionStatus = t2Execution.split('\n## ')[0].split('\n')
    .filter(line => line.startsWith('**Status:**'));
  assert(t2ExecutionStatus.length === 1 &&
    t2ExecutionStatus[0] === '**Status:** T2 CLOSED / ENGINEERING_SYNTHETIC_ONLY / T2-G REMAINDER_DEFERRED',
  'T2 execution status must retain the bounded closed gate', errors);
  for (const file of [
    'family-self-directed-learning-mvp-gate.md',
    'family-self-directed-learning-t2-execution.md',
    'family-self-directed-learning-t2-qa-p2-review.md',
    'family-self-directed-learning-t2-d2b-budget-followup.md'
  ]) {
    const document = read(`docs/development/${file}`);
    for (const [key, value] of [
      ['D2B budget', 'APPROVED / CLOSED / SYNTHETIC_ONLY'],
      ['D2B isolation P3', 'APPROVED / CLOSED'],
      ['D2B retained', 'HISTORICAL_FAILURES_PRESERVED / DEVICE_PENDING / REMAINDER_DEFERRED / T8_PENDING / NOT_AUTHORIZED']
    ]) {
      const lines = document.split('\n').filter(line => line.startsWith(`**${key}:**`));
      assert(lines.length === 1 && lines[0] === `**${key}:** ${value}`,
        `${file}: ${key} must remain uniquely ${value}`, errors);
    }
  }
  try {
    const approval = JSON.parse(read('docs/development/family-self-directed-learning-t2-closure-approval.json'));
    assert(approval.schemaVersion === 1 && approval.task === 'T2' && approval.status === 'APPROVED' &&
      approval.gateStatus === 'CLOSED' && approval.date === '2026-10-24' &&
      approval.source === 'latest_direct_user_instruction' &&
      approval.instruction === '批准 T2 限定合成范围的工程验收及总门禁关闭，同步更新门禁、评审记录、实施计划和状态校验。保留本轮 D2B-05 失败证据，不将全量写为全绿；真机保持 DEVICE_PENDING，高级恢复与新回收继续后置，不部署、不提交或推送 Git。',
    'T2 approval record must retain the latest explicit closure instruction', errors);
    assert(approval.scope === 'ENGINEERING_SYNTHETIC_ONLY',
      'T2 approval record must retain ENGINEERING_SYNTHETIC_ONLY', errors);
    assert(approval.batchStatus === 'CLOSED' &&
      isDeepStrictEqual(approval.batches, ['T2-2', 'T2-3', 'T2-4', 'T2-5', 'T2-6']) &&
      isDeepStrictEqual(approval.defects, {
        'T2-P2-JWT': 'CLOSED', 'T2-P2-SNAPSHOT': 'CLOSED', 'T2-P2-BODY-SYNC': 'CLOSED'
      }), 'T2 approval record must close exactly the three reviewed P2 defects and approved batches', errors);
    assert(isDeepStrictEqual(approval.latestFullRegression, {
      status: 'FAILED', exitCode: 1, suites: 143, passedSuites: 142, failedSuites: 1,
      tests: 3943, passedTests: 3942, failedTests: 1, pendingTests: 0,
      failureId: 'D2B-05', disposition: 'REMAINDER_DEFERRED',
      evidence: 'release-gate-artifacts/t2-p2-approved-acceptance-2026-10-24/family.json'
    }), 'T2 approval must preserve the failed full regression and deferred D2B-05 evidence', errors);
    assert(isDeepStrictEqual(approval.notAuthorized, [
      'real_child_data', 'real_NAS_operations', 'deployment', 'git_commit_or_push',
      'automatic_start_of_T3-T9'
    ]), 'T2 approval must preserve prohibited operations', errors);
    assert(isDeepStrictEqual(approval.retained, {
      device: 'DEVICE_PENDING', deployment: 'T8_PENDING / NOT_AUTHORIZED',
      advancedRecoveryAndNewCleanup: 'REMAINDER_DEFERRED', T1: 'CLOSED',
      'T3-T9': 'NOT_STARTED', 'SL-01': 'PLANNED'
    }), 'T2 approval record must preserve pending and deferred boundaries', errors);
  } catch (error) {
    errors.push('T2 approval record must be present and valid JSON');
  }
  const t3Rows = taskStatusRows.filter(cells => cells[1] === 'T3');
  assert(t3Rows.length === 1 && t3Rows[0][2] === 'CLOSED',
    'self-directed Gate must have exactly one CLOSED T3 row', errors);
  for (const [key, value] of [['T3 gate', 'CLOSED'], ['T3 approval', 'APPROVED'],
    ['T3 scope', 'ENGINEERING_SYNTHETIC_ONLY'], ['T3 device', 'DEVICE_PENDING'],
    ['T3 deferred', 'REMAINDER_DEFERRED']]) {
    const lines = gateHeader.split('\n').filter(line => line.startsWith(`**${key}:**`));
    assert(lines.length === 1 && lines[0] === `**${key}:** ${value}`, `${key} must remain ${value}`, errors);
  }
  try {
    const evidenceRoot = 'docs/development/evidence/t3-synthetic-2026-10-25';
    const approval = JSON.parse(read(`${evidenceRoot}/approval.json`));
    const reviewText = read(`${evidenceRoot}/independent-review.json`);
    const review = JSON.parse(reviewText);
    assert(approval.schemaVersion === 1 && approval.task === 'T3' &&
      approval.status === 'APPROVED' && approval.gateStatus === 'CLOSED' &&
      approval.scope === 'ENGINEERING_SYNTHETIC_ONLY' &&
      approval.source === 'direct_user_conditional_closeout_authorization' &&
      approval.instruction === '同意,按你的建议逐步执行以上四步收尾顺序,直到这四步全部完成',
    'T3 approval must retain the conditional user authorization', errors);
    const candidate = '0b7c40fca678cd5b7fc1e6bd821d03f653d7f909';
    assert(approval.reviewedCommit === candidate && review.candidateCommit === candidate &&
      review.decision === 'PASS' && review.openFindings === 0 &&
      approval.reviewSha256 === createHash('sha256').update(reviewText).digest('hex'),
    'T3 independent review must bind the reviewed candidate and unchanged passing evidence', errors);
    const defects = { 'T3-HELP-P2-PARENT-DENIAL': 'CLOSED', 'T3-HELP-P2-LOADING': 'CLOSED' };
    assert(isDeepStrictEqual(approval.defects, defects) &&
      isDeepStrictEqual(review.defects, defects),
    'T3 must close exactly the independently reviewed P2 defects', errors);
    assert(isDeepStrictEqual(approval.retained, {
      historicalFailures: 'PRESERVED', device: 'DEVICE_PENDING',
      advancedRecoveryAndNewCleanup: 'REMAINDER_DEFERRED',
      deployment: 'T8_PENDING / NOT_AUTHORIZED', 'T4-T9': 'NOT_STARTED', 'SL-02': 'PLANNED'
    }), 'T3 approval must retain pending and deferred boundaries', errors);
    const submission = JSON.parse(read(`${evidenceRoot}/delivery.json`));
    assert(submission.historicalIndependentBaseline.decision === 'NEEDS_FIXES' &&
      submission.historicalIndependentBaseline.openP2 === 2 && submission.gateAtSubmission === 'OPEN',
    'T3 must preserve its original failed independent review and open submission snapshot', errors);
  } catch (error) {
    errors.push('T3 approval and independent review must be present and valid JSON');
  }
  const t4Rows = taskStatusRows.filter(cells => cells[1] === 'T4');
  assert(t4Rows.length === 1 && t4Rows[0][2] === 'IN_PROGRESS'
    && t4Rows[0][3].includes('总门禁 OPEN') && t4Rows[0][3].includes('关闭需用户批准'),
  'T4 must be IN_PROGRESS with OPEN gate and user approval required for closure', errors);
  for (const task of Array.from({ length: 5 }, (_, index) => `T${index + 5}`)) {
    assert(
      taskStatusTable.includes(`| ${task} | NOT_STARTED |`),
      `self-directed Gate must keep ${task} as NOT_STARTED`,
      errors
    );
  }

  for (const [name, markdown, marker] of [
    ['research', selfDirectedResearch, '状态：拟议方案'],
    ['design', selfDirectedDesign, '状态：拟议设计'],
    ['plan', selfDirectedPlan, '状态：执行中（T0 已完成，T1 后端工程已关闭，T2 合成工程已关闭，T3 合成工程已关闭，T4 实施中，T5-T9 待执行）'],
    ['Gate', selfDirectedGate, '**Status:** T0 CONTRACT BASELINE']
  ]) {
    assert(markdown.includes(marker), `self-directed ${name} must remain explicitly planned`, errors);
    assert(
      !/[ \t]+$/m.test(markdown),
      `self-directed ${name} contains trailing whitespace`,
      errors
    );
  }

  for (const [name, markdown, sectionMarker] of [
    ['PRD', product, '## 14. 自主学习 MVP 增量需求（PLANNED）'],
    ['architecture', architecture, '## 12. 自主学习 MVP 增量架构契约（PLANNED）'],
    ['API', api, '## 14. 自主学习 MVP 增量 API 契约（PLANNED）']
  ]) {
    assert(
      markdown.includes(sectionMarker),
      `${name} must keep the autonomous-learning increment explicitly PLANNED`,
      errors
    );
  }

  const canonicalSelfDirectedContracts = [
    ['architecture', architecture],
    ['API', api],
    ['system design', selfDirectedDesign],
    ['plan', selfDirectedPlan],
    ['Gate', selfDirectedGate]
  ];
  for (const [name, markdown] of canonicalSelfDirectedContracts) {
    assert(
      markdown.includes('IDEMPOTENCY_KEY_REUSED'),
      `${name} is missing the canonical idempotency error`,
      errors
    );
    assert(
      !markdown.includes('IDEMPOTENCY_CONFLICT'),
      `${name} contains obsolete IDEMPOTENCY_CONFLICT`,
      errors
    );
  }

  for (const [name, markdown] of [
    ['architecture', architecture],
    ['API', api],
    ['Gate', selfDirectedGate]
  ]) {
    for (const requiredText of [
      'mediaRemoteOutcomeUncertain',
      'GET 不触发恢复',
      'expectedCompletionVersion=0',
      '404 RESOURCE_NOT_FOUND'
    ]) {
      assert(
        markdown.includes(requiredText),
        `${name} is missing canonical T0 contract text ${requiredText}`,
        errors
      );
    }
  }

  for (const [name, markdown] of [
    ['architecture', architecture],
    ['API', api]
  ]) {
    assert(
      markdown.includes('历史无媒体确认是唯一例外'),
      `${name} must exempt legacy confirmation from the generic first-write version increment`,
      errors
    );
  }

  for (const requiredText of [
    '无活动 owner CAS：命令占位 + remoteOperationId + 规范 patch + pending 意图 + 媒体差集',
    'CAS mediaRemoteOutcomeUncertain=true',
    '完全相同 PATCH + 原 operationId 重试',
    'GET 不触发恢复',
    'T0 已完成契约基线'
  ]) {
    assert(
      selfDirectedDesign.includes(requiredText),
      `system design is missing remediated T0 sequence/status text ${requiredText}`,
      errors
    );
  }

  const completionSequenceStart = selfDirectedDesign.indexOf('### 9.2 上传作品并完成任务');
  const completionSequenceEnd = selfDirectedDesign.indexOf('### 9.3 家长审核与订正');
  assert(
    completionSequenceStart >= 0 && completionSequenceEnd > completionSequenceStart,
    'system design is missing the bounded section 9.2 completion sequence',
    errors
  );
  const completionSequence = selfDirectedDesign.slice(completionSequenceStart, completionSequenceEnd);
  const completionSequenceSteps = [
    '无活动 owner CAS：命令占位 + remoteOperationId + 规范 patch + pending 意图 + 媒体差集',
    'CAS mediaRemoteOutcomeUncertain=true',
    'prepare 新增集合/持久化 remoteOperationId 与目标代次',
    'commit 新增集合/同一 remoteOperationId 与目标代次',
    '原子发布证据、递增版本、固化响应投影，进入 PUBLISHED_CLEANUP',
    '当前 remoteOperationId / 精确旧 bindingOperationId unbind',
    '原子置 SUCCEEDED/stable，清除 pending 和 owner'
  ];
  let previousSequenceStep = -1;
  for (const step of completionSequenceSteps) {
    const currentSequenceStep = completionSequence.indexOf(step);
    assert(
      currentSequenceStep > previousSequenceStep,
      `system design completion sequence is missing or misorders ${step}`,
      errors
    );
    previousSequenceStep = currentSequenceStep;
  }
  assert(
    completionSequence.includes('GET 不触发恢复'),
    'system design section 9.2 must keep GET recovery side-effect free',
    errors
  );

  const implementationStatusStart = selfDirectedDesign.indexOf('## 15. 编码实施顺序');
  const implementationStatusEnd = selfDirectedDesign.indexOf('### 15.1');
  const implementationStatus = selfDirectedDesign.slice(
    implementationStatusStart,
    implementationStatusEnd
  );
  assert(
    implementationStatusStart >= 0 && implementationStatusEnd > implementationStatusStart,
    'system design is missing the bounded implementation-status section',
    errors
  );
  assert(
    implementationStatus.includes('T0 已完成契约基线') &&
      implementationStatus.includes('T1 后端工程已关闭，仅限既定合成验收') &&
      implementationStatus.includes('T2 合成工程已关闭，T3 合成工程已关闭，T4 实施中，T5–T9 待执行'),
    'system design must record T0 complete, T1 closed and T2 closed in section 15',
    errors
  );

  const sourceContractStart = api.indexOf('### 14.5 `SL-05`');
  const sourceContractEnd = api.indexOf('### 14.6 `SL-06`');
  const sourceContract = api.slice(sourceContractStart, sourceContractEnd);
  assert(
    sourceContractStart >= 0 && sourceContractEnd > sourceContractStart,
    'API is missing the bounded SL-05 source contract section',
    errors
  );
  assert(
    /来源不存在、属于其他\s+家庭或属于其他孩子，对公开调用统一返回相同的 `404 RESOURCE_NOT_FOUND` 响应/.test(
      sourceContract
    ),
    'SL-05 source contract must use one public 404 for absent and cross-scope sources',
    errors
  );
  assert(
    !/(?:跨家庭|跨孩子|scope)[^\n]*(?:统一)?返回 `?403|`?403[^\n]*(?:跨家庭|跨孩子|scope)/.test(
      sourceContract
    ),
    'SL-05 source contract must not define public 403 semantics for cross-scope sources',
    errors
  );

  const apiConfirmationStart = api.indexOf('#### 家长确认所见作品版本');
  const apiConfirmationEnd = api.indexOf('### 14.3 `SL-02`');
  assert(
    apiConfirmationStart >= 0 && apiConfirmationEnd > apiConfirmationStart,
    'API is missing the bounded legacy confirmation contract section',
    errors
  );
  const apiConfirmationContract = api
    .slice(apiConfirmationStart, apiConfirmationEnd)
    .replace(/\s+/g, ' ');
  for (const requiredText of [
    'expectedCompletionVersion=0',
    '把缺失版本持久化为 0',
    '确认本身不 递增 `completionVersion`',
    '`starAwardState` 置为 pending',
    '版本初始化不单独发星，也不能使重复确认再次发星'
  ]) {
    assert(
      apiConfirmationContract.includes(requiredText),
      `API legacy confirmation contract is missing ${requiredText}`,
      errors
    );
  }

  const architectureMigrationStart = architecture.indexOf('### 12.6 迁移、发布兼容和回滚');
  const architectureMigrationEnd = architecture.indexOf(
    '上述增量未改变现有架构决策',
    architectureMigrationStart
  );
  assert(
    architectureMigrationStart >= 0 && architectureMigrationEnd > architectureMigrationStart,
    'architecture is missing the bounded section 12.6 migration contract',
    errors
  );
  const architectureMigrationContract = architecture
    .slice(architectureMigrationStart, architectureMigrationEnd)
    .replace(/\s+/g, ' ');
  for (const requiredText of [
    'expectedCompletionVersion=0',
    '把缺失版本持久化为 0',
    '但不递增版本',
    '`starAwardState` 置为 `pending`',
    '沿用现有可恢复发星命令',
    '版本初始化本身不发星',
    '重复确认不得重复发星'
  ]) {
    assert(
      architectureMigrationContract.includes(requiredText),
      `architecture legacy confirmation contract is missing ${requiredText}`,
      errors
    );
  }

  assert(
    /先在本地事务中[\s\S]{0,160}pending[\s\S]{0,240}(?:prepare|远程媒体调用)/.test(api),
    'API must persist the completion intent before remote media prepare',
    errors
  );

  const stableMediaSections = [
    ['architecture', boundedSection(
      architecture,
      '### 12.3 完成命令幂等与并发',
      '### 12.4 `DailyLearningPlan`'
    )],
    ['API', boundedSection(api, '#### 完成任务', '#### 家长确认所见作品版本')],
    ['system design', boundedSection(selfDirectedDesign, '### 7.3 孩子完成任务', '### 7.4 周反思')],
    ['plan', boundedSection(selfDirectedPlan, '### T1：', '### T2：')],
    ['Gate', boundedSection(selfDirectedGate, '### 4.1 完成作品', '### 4.2 清单与求助')]
  ];
  for (const [name, section] of stableMediaSections) {
    assert(section.length > 0, `${name} is missing its bounded stable-media section`, errors);
    for (const contractError of stableMediaContractErrors(section)) {
      errors.push(`${name} stable-media contract ${contractError}`);
    }
  }
  for (const caseId of [
    'TC-SL-REMOTE-ID-001',
    'TC-SL-REMOTE-ID-002',
    'TC-SL-REMOTE-ID-003',
    'TC-SL-REMOTE-ID-004'
  ]) {
    assert(
      stableMediaSections.find(([name]) => name === 'plan')[1].includes(caseId) &&
        selfDirectedGate.includes(caseId),
      `remote identity acceptance case must be tracked in T1 and Gate: ${caseId}`,
      errors
    );
  }

  const architectureCompletionModel = boundedSection(
    architecture,
    'completionEvidence?',
    'completionMediaReferenceState?'
  );
  const systemDesignCompletionModel = boundedSection(
    selfDirectedDesign,
    'completionEvidence?',
    '```'
  );
  for (const [name, model] of [
    ['architecture', architectureCompletionModel],
    ['system design', systemDesignCompletionModel]
  ]) {
    assert(model.length > 0, `${name} is missing the bounded completionEvidence model`, errors);
    for (const contractError of completionEvidenceContractErrors(model)) {
      errors.push(`${name} ${contractError}`);
    }
  }
  for (const requiredText of [
    '`helpType` 只属于当前 `helpRequest`',
    '`needsHelp` 继续表示完成时的困难回顾',
    '`supportLevelUsed` 继续作为 P2 储备',
    '`other`：其他，由简短 `note` 补充',
    '具体字段和路由已进入正式 API 契约'
  ]) {
    assert(
      selfDirectedDesign.includes(requiredText),
      `system design is missing help-field boundary ${requiredText}`,
      errors
    );
  }

  const alternativeFenceProbeErrors = [];
  checkMarkdownStructure(
    'self-directed-json-fence-probe.md',
    '  ~~~json\n  {"operationId":"one","operationId":"two"}\n  ~~~\n',
    alternativeFenceProbeErrors
  );
  assert(
    alternativeFenceProbeErrors.some(error => error.includes('duplicate keys: operationId')),
    'Markdown JSON validation must reject duplicate keys inside indented tilde fences',
    errors
  );

  const helpReplaySections = [
    ['architecture', boundedSection(
      architecture,
      '### 12.2 `GrowthTask` 计划字段',
      '### 12.3 完成命令幂等与并发'
    )],
    ['API', boundedSection(api, '### 14.3 `SL-02`', '### 14.4 `SL-04`')],
    ['system design', boundedSection(
      selfDirectedDesign,
      '#### 进行中独立求助（P1）',
      '### 5.4 任务模板（P2，非首期）'
    )],
    ['plan', boundedSection(selfDirectedPlan, '### T3：', '### T4：')],
    ['Gate', boundedSection(selfDirectedGate, '### 4.2 清单与求助', '### 4.3 日计划')]
  ];
  for (const [name, section] of helpReplaySections) {
    assert(section.length > 0, `${name} is missing its bounded help replay section`, errors);
    for (const contractError of helpReplayContractErrors(section)) {
      errors.push(`${name} help replay contract ${contractError}`);
    }
  }

  const completionModelMutant = architectureCompletionModel.replace(
    '  needsHelp?',
    '  needsHelp?\n  helpType?'
  );
  assert(
    completionEvidenceContractErrors(completionModelMutant).length > 0,
    'completionEvidence contract probe must reject reintroducing helpType',
    errors
  );
  const reservedFieldMutant = architectureCompletionModel.replace(
    '  needsHelp?',
    '  needsHelp?\n  supportLevelUsed?'
  );
  assert(
    reservedFieldMutant !== architectureCompletionModel &&
      completionEvidenceContractErrors(reservedFieldMutant)
        .some(error => error.includes('supportLevelUsed')),
    'completionEvidence contract probe must reject reintroducing supportLevelUsed',
    errors
  );
  for (const marker of [
    '不可变成功响应投影',
    '每个任务最多一个活动完成命令',
    '发布后不得回滚已发布作品',
    'absent 不能作为失败终态证据',
    '租约过期原子转为 ABORTED',
    '`remoteOperationId`',
    '远程标识与首次命令占位同事务持久化',
    '内部 operationId 必须取持久化 remoteOperationId',
    'remoteOperationId 唯一索引',
    '不同 actor 使用同一 UUID 必须分配不同远程标识'
  ]) {
    const original = stableMediaSections[0][1];
    const mutant = original.replaceAll(marker, 'removed-contract-rule');
    assert(
      mutant !== original && stableMediaContractErrors(mutant).includes(`missing ${marker}`),
      `completion contract probe must reject removing ${marker}`,
      errors
    );
  }
  const helpReplayMutant = helpReplaySections[0][1].replace(
    '认证 actor 与 `requestedByActor` 相同',
    '认证 actor 无需与 `requestedByActor` 相同'
  );
  assert(
    helpReplayContractErrors(helpReplayMutant).length > 0,
    'help replay contract probe must reject removing actor equality',
    errors
  );
  const stableMediaMutant = stableMediaSections[1][1].replace(
    '清除 pending 意图',
    '保留 pending 意图'
  );
  assert(
    stableMediaContractErrors(stableMediaMutant).length > 0,
    'stable-media contract probe must reject retaining pending after a stable rejection',
    errors
  );

  const checklistInitializationSections = [
    ['architecture', boundedSection(
      architecture,
      '### 12.2 `GrowthTask` 计划字段',
      '### 12.3 完成命令幂等与并发'
    )],
    ['API', boundedSection(api, '#### 家长创建或更新清单', '#### 完成任务')],
    ['system design', boundedSection(
      selfDirectedDesign,
      '### 5.3 `GrowthTask` 的 P1 最小扩展',
      '### 5.4 任务模板（P2，非首期）'
    )],
    ['plan', boundedSection(selfDirectedPlan, '### T4：', '### T5：')],
    ['Gate', boundedSection(selfDirectedGate, '### 4.2 清单与求助', '### 4.3 日计划')]
  ];
  for (const [name, section] of checklistInitializationSections) {
    assert(section.length > 0, `${name} is missing its bounded checklist section`, errors);
    for (const contractError of checklistInitializationErrors(section)) {
      errors.push(`${name} checklist initialization contract ${contractError}`);
    }
  }
  const checklistMutant = checklistInitializationSections[1][1].replace(
    '`checklistVersion=1`',
    '`checklistVersion=0`'
  );
  assert(
    checklistInitializationErrors(checklistMutant).length > 0,
    'checklist initialization probe must reject a non-empty version of zero',
    errors
  );

  for (const error of valueGateContractErrors(selfDirectedGate)) {
    errors.push(`self-directed value gate ${error}`);
  }
  const valueGateBody = boundedSection(selfDirectedGate, '## 14. T9 轻量价值验收规程', '## 15. R1–R8');
  for (const [, marker] of valueGateTextRules) {
    const mutant = selfDirectedGate.replace(valueGateBody, valueGateBody.split(marker).join('REMOVED_CLAUSE'));
    assert(valueGateContractErrors(`${mutant}\nHistorical note: ${marker}`).length > 0,
      `value gate probe must reject removed normative clause: ${marker}`, errors);
  }
  for (const [id, , expected] of valueGateExamples) {
    const row = valueGateBody.split('\n').find(line => line.startsWith(`| ${id} |`));
    const mutant = row ? selfDirectedGate.replace(row, row.replace(`| ${expected} |`, '| WRONG |')) : selfDirectedGate;
    assert(valueGateContractErrors(mutant).length > 0,
      `value gate probe must reject incorrect synthetic result: ${id}`, errors);
  }
  const valueGateStructuralMutants = [];
  const valueGateDecision = valueGateSections(selfDirectedGate).decision;
  for (const label of ['PASS', 'PARTIAL', 'FAIL']) {
    const row = valueGateDecision.split('\n').find(line => line.startsWith(`| ${label} |`));
    assert(Boolean(row), `value gate probe needs the normative ${label} definition`, errors);
    if (!row) continue;
    valueGateStructuralMutants.push(
      [`${label} definition moved to history`,
        selfDirectedGate.replace(valueGateBody, valueGateBody.replace(row, '')) + `\nHistorical copy:\n${row}`],
      [`duplicate ${label} definition`,
        selfDirectedGate.replace(valueGateBody, valueGateBody.replace(row, `${row}\n${row}`))]
    );
  }
  const resumePassClause = '若调整后已有至少两次不同日期的可比复核证据表明负向问题已解决，且全部其他前提满足，才可重新判 PASS；';
  assert(valueGateDecision.includes(resumePassClause), 'value gate probe needs the normative resume-PASS threshold', errors);
  valueGateStructuralMutants.push(['resume-PASS threshold deleted, history retained',
    selfDirectedGate.replace(valueGateBody, valueGateBody.replace(resumePassClause, '')) + `\nHistorical copy:\n${resumePassClause}`]);
  for (const [name, mutant] of valueGateStructuralMutants) {
    assert(valueGateContractErrors(mutant).length > 0,
      `value gate probe must reject ${name}`, errors);
  }

  for (const requiredText of [
    '一周轻量无干预基线 → P0 人工预演与最小 P1 实现 → 四周正式家庭验证',
    'T1–T8 完成后执行 T9 四周正式家庭验证'
  ]) {
    assert(
      selfDirectedResearch.includes(requiredText),
      `self-directed research conclusion is missing implementation order ${requiredText}`,
      errors
    );
  }

  for (const [name, markdown, markers] of [
    ['PRD direction', product, ['LONG-TERM DIRECTION CONFIRMED', 'FGT-MVP-1.7 已实现基础', 'SL-01 至 SL-07 全部 PLANNED']],
    ['architecture direction', architecture, ['长期目标是家庭自主学习', 'FGT-MVP-1.7 已实现基础']],
    ['value gate', selfDirectedGate, ['## 14. T9 轻量价值验收规程', 'BASELINE_MISSING', 'BASELINE_CONTAMINATED', '| PASS |', '| PARTIAL |', '| FAIL |', '缺失不计零、不插补', '独立复评状态：']],
    ['privacy lifecycle', architecture, ['MediaDeletionTombstone', 'referenceFence', '最后释放时间两者都满 30 天', '凭证不可用时停止恢复上线']],
    ['privacy API', api, ['#### 完成作品隐私删除（PLANNED）', 'privacyDeletion', '其他 released/absent', '全量家庭数据导出/删除']],
    ['estimate API', api, ['estimateRecordedBy', 'updatedByActor', '同值/仅排序保留原归属', '旧记录无归属返回 null']],
    ['device path', selfDirectedDesign, ['TC-SL-IPAD-001', 'TC-SL-IPAD-002', 'TC-SL-IPAD-003', 'TC-SL-IPAD-004', 'DEVICE_PENDING', '不能改后缀冒充格式']],
    ['review record', selfDirectedGate, ['## 13. R1–R8', '### 13.1 方案自审（实施前）', '方案自审结论：通过']]
  ]) {
    for (const marker of markers) {
      assert(markdown.includes(marker), `${name} is missing review contract ${marker}`, errors);
    }
  }
  for (const [name, markdown] of canonicalSelfDirectedContracts) {
    for (const marker of ['privacyDeletion', 'estimateRecordedBy', 'updatedByActor']) {
      assert(markdown.includes(marker), `${name} is missing revised contract ${marker}`, errors);
    }
  }
  const interactionApi = boundedSection(selfDirectedDesign, '### 7.1 日计划', '### 7.4 周反思');
  assert(
    interactionApi.length > 0 && !/```json\b/.test(interactionApi) &&
      !selfDirectedDesign.includes('编码前必须补充正式契约'),
    'system design must reference canonical API instead of duplicate P1 request JSON or stale contract status',
    errors
  );

  for (const requiredText of [
    'operationId',
    'expectedCompletionVersion',
    'expectedChecklistVersion',
    'expectedHelpVersion',
    'expectedVersion',
    'MEDIA_REFERENCE_PENDING',
    'VERSION_CONFLICT',
    'IDEMPOTENCY_KEY_REUSED',
    '旧客户端',
    '按需原子初始化',
    '不得批量重写'
  ]) {
    assert(
      selfDirectedGate.includes(requiredText),
      `self-directed Gate is missing T0 contract marker ${requiredText}`,
      errors
    );
  }

  assert(
    traceability.includes('COVERED (38/38)') &&
      traceability.includes('自主学习增量不计入 38/38'),
    'traceability must preserve the implemented 38/38 baseline and separate the planned increment',
    errors
  );
  for (const obsoleteText of [
    '小学生学习追踪系统',
    '最大并发用户：10000',
    'API响应时间：<100ms',
    '张三',
    '李四',
    '王五',
    'example.com',
    'Redux Toolkit',
    'Prometheus + Grafana'
  ]) {
    assert(
      !repositoryReadme.includes(obsoleteText),
      `README.md contains obsolete or unverified content: ${obsoleteText}`,
      errors
    );
  }

  for (const requiredText of [
    'npm run docs:family:check',
    './product/family-learning-tracker.md',
    './architecture/family-learning-tracker-architecture.md',
    './api/family-learning-tracker-api.md',
    './development/README.md',
    './deployment/README.md',
    './user-guide/README.md'
  ]) {
    assert(
      documentationReadme.includes(requiredText),
      `docs/README.md is missing ${requiredText}`,
      errors
    );
  }
  for (const templateHeading of [
    '## 文档类型',
    '## 文档工具',
    '## 文档自动化',
    '## 文档质量'
  ]) {
    assert(
      !documentationReadme.includes(templateHeading),
      `docs/README.md contains obsolete template heading: ${templateHeading}`,
      errors
    );
  }

  for (const requiredText of [
    'Node.js 22',
    'npm ci --prefix frontend/web',
    'npm run test:family-regression',
    'npm run test:ci --prefix frontend/web -- --runInBand',
    'npm run test:task11',
    'npm run test:task12',
    'npm run release:family'
  ]) {
    assert(
      developmentReadme.includes(requiredText),
      `docs/development/README.md is missing ${requiredText}`,
      errors
    );
  }
  for (const obsoleteText of [
    '我们使用 Cypress',
    'npm run cypress:open',
    'npm run cypress:run',
    '我们采用 Git Flow',
    '`.prettierrc`',
    'cd ../frontend'
  ]) {
    assert(
      !developmentReadme.includes(obsoleteText),
      `docs/development/README.md contains obsolete content: ${obsoleteText}`,
      errors
    );
  }

  const productIds = requirementIds(product);
  const traceabilityIds = requirementIds(traceability);
  const designIds = requirementIds(designIndex);
  assert(productIds.size === 38, `PRD requirement count is ${productIds.size}, expected 38`, errors);
  assert(
    sameSet(traceabilityIds, productIds),
    'traceability requirement set differs from PRD 10.4',
    errors
  );
  assert(
    sameSet(designIds, productIds),
    'design asset requirement set differs from PRD 10.4',
    errors
  );

  const traceabilityRows = traceability
    .split('\n')
    .filter(line => /^\|\s*`(?:FR|NFR)-[A-Z]+-\d{3}`\s*\|/.test(line));
  const coveredRows = traceabilityRows.filter(line => line.includes('| COVERED |'));
  const approvedDesignRows = traceabilityRows.filter(line => line.includes('| DESIGN_APPROVED |'));
  assert(coveredRows.length === 38, `traceability has ${coveredRows.length} COVERED rows, expected 38`, errors);
  assert(
    approvedDesignRows.length === 0,
    'implemented FGT-MVP-1.7 must not retain DESIGN_APPROVED rows',
    errors
  );
  assert(
    traceability.includes('**Document status:** FGT-MVP-1.7 IMPLEMENTED / RELEASE GATE'),
    'traceability must identify the implemented v1.7 release candidate',
    errors
  );
  assert(
    traceability.includes('**Implementation conformance:** COVERED (38/38)'),
    'traceability must record all 38 implemented requirements',
    errors
  );
  assert(
    traceability.includes('**Baseline candidate:** FGT-MVP-1.7'),
    'traceability must target FGT-MVP-1.7',
    errors
  );

  const task12Design = documents.get(
    'docs/superpowers/specs/2026-07-16-family-growth-task12-co-parent-design.md'
  ) || '';
  const task12Tests = documents.get('docs/development/family-growth-task12-test-cases.md') || '';
  const task12Review = documents.get('docs/development/family-growth-task12-design-review.md') || '';
  const task12Gate = documents.get('docs/development/family-growth-task12-gate.md') || '';
  const task12Adr = documents.get(
    'docs/architecture/decisions/0008-co-parent-membership-governance.md'
  ) || '';
  for (const requirement of ['FR-FAM-004', 'FR-FAM-005', 'NFR-DATA-003']) {
    for (const [name, markdown] of [
      ['Task 12 design', task12Design],
      ['Task 12 tests', task12Tests],
      ['Task 12 review', task12Review]
    ]) {
      assert(markdown.includes(requirement), `${name} is missing ${requirement}`, errors);
    }
  }
  for (const requiredText of [
    'APPROVED DESIGN / IMPLEMENTATION BASELINE',
    '72 hours',
    'FamilyParentInvitation',
    'FamilyMembershipEvent',
    'FAMILY_INVITATION_NOT_ACTIVE',
    'runMongoTransaction',
    'useLocation().hash',
    'resource-service',
    '`--check`'
  ]) {
    assert(task12Design.includes(requiredText), `Task 12 design is missing ${requiredText}`, errors);
  }
  for (const requiredText of [
    '**Status:** Accepted',
    'opaque token',
    'Family.memberParentIds',
    'User.children',
    'MongoDB',
    'resource-service',
    '`--check`'
  ]) {
    assert(task12Adr.includes(requiredText), `ADR-0008 is missing ${requiredText}`, errors);
  }
  for (const testId of [
    'TC-T12-INV-007',
    'TC-T12-ACCESS-004',
    'TC-T12-AUTH-001',
    'TC-T12-PROJ-001',
    'TC-T12-PROJ-002',
    'TC-T12-UI-007',
    'TC-T12-REPAIR-003',
    'TC-T12-REPAIR-004'
  ]) {
    assert(task12Tests.includes(testId), `Task 12 tests are missing ${testId}`, errors);
  }
  assert(
    task12Tests.includes('**Document status:** APPROVED / IMPLEMENTED'),
    'Task 12 test design must record approval and implementation',
    errors
  );
  assert(
    task12Review.includes('**Status:** APPROVED'),
    'Task 12 design review must record approval',
    errors
  );
  for (const requiredText of [
    '**Baseline:** FGT-MVP-1.7',
    'npm run release:family',
    'npm run test:task12:integration',
    'npm run test:task12:e2e',
    'npm run repair:family-relationships:check',
    'Target-environment activation'
  ]) {
    assert(task12Gate.includes(requiredText), `Task 12 Gate is missing ${requiredText}`, errors);
  }
  const releaseScript = read('scripts/release-family-gate.sh');
  for (const requiredCommand of [
    'npm run test:task12:integration',
    'npm run test:task12:e2e'
  ]) {
    assert(
      releaseScript.includes(requiredCommand),
      `unified release Gate is missing ${requiredCommand}`,
      errors
    );
  }

  assert(
    manifest.includes('**status:** READY_FOR_REVIEW'),
    'v1.6 manifest must remain READY_FOR_REVIEW',
    errors
  );
  assert(
    manifest.includes(
      '**implementationEvidenceCommit:** `30d0e7bb4adddc51edc7d412f82aac8d323f2bfd`'
    ),
    'v1.6 manifest must identify the verified implementation commit',
    errors
  );
  for (const evidence of [
    '17 份权威文档',
    '70 suites / 756 tests',
    '25 suites / 156 tests',
    '4 suites / 6 tests',
    '4 Chromium tests',
    '91-byte PNG'
  ]) {
    assert(manifest.includes(evidence), `v1.6 manifest is missing ${evidence}`, errors);
  }
  for (const staleClaim of [
    '52 suites / 652',
    '58 suites / 675',
    '23 suites / 149',
    '当前创建家庭和孩子会顺序写多个文档，不在一个事务内',
    '当前删除路由允许把 `confirmed + starAwardState=pending` 的任务归档',
    '发布前必须单独启用并通过受控 build/deploy gate'
  ]) {
    assert(
      !manifest.includes(staleClaim),
      `v1.6 manifest contains obsolete claim: ${staleClaim}`,
      errors
    );
  }

  for (const evidence of ['17 份权威文档', '70 suites / 756 tests']) {
    assert(
      releaseGate.includes(evidence),
      `v1.6 release gate is missing ${evidence}`,
      errors
    );
  }

  for (const requiredText of [
    'questionMediaIds',
    'childAnswerMediaIds',
    'application/pdf',
    'MALWARE_DETECTED',
    'MALWARE_SCANNER_UNAVAILABLE',
    'trusted-local',
    'secure-production'
  ]) {
    assert(api.includes(requiredText), `API contract is missing ${requiredText}`, errors);
  }

  for (const requiredText of [
    'RUN_FAMILY_SECURITY_SCAN=1 npm run test:family-security-scan',
    'trusted-local',
    'secure-production',
    '10 GiB'
  ]) {
    assert(
      deployment.includes(requiredText),
      `deployment guide is missing secure-media boundary ${requiredText}`,
      errors
    );
    assert(
      attachmentGate.includes(requiredText),
      `attachment gate is missing ${requiredText}`,
      errors
    );
  }

  assert(
    userGuide.includes('知识与能力点'),
    'user guide navigation is missing 知识与能力点',
    errors
  );
  assert(
    !childGuide.includes('姓名、昵称、年级、学校'),
    'child guide describes profile fields that the child UI does not render',
    errors
  );
  for (const [relativePath, markdown] of [
    ['docs/user-guide/quick-start.md', quickStart],
    ['docs/user-guide/parent-guide.md', parentGuide],
    ['docs/user-guide/child-guide.md', childGuide]
  ]) {
    assert(markdown.includes('PDF'), `${relativePath} is missing PDF guidance`, errors);
    assert(markdown.includes('10 MiB'), `${relativePath} is missing media size guidance`, errors);
  }

  for (const requiredText of [
    'cp docker-compose.ubuntu.env.example .env',
    '该 `.env` 位于仓库根目录'
  ]) {
    assert(
      ubuntuDeployment.includes(requiredText),
      `Ubuntu deployment guide is missing ${requiredText}`,
      errors
    );
  }
  assert(
    !ubuntuDeployment.includes('backend/.env'),
    'Ubuntu deployment guide must not direct operators to backend/.env',
    errors
  );

  const ubuntuTemplateKeys = new Set(Object.keys(dotenv.parse(ubuntuEnvironment)));
  const ubuntuRequiredSecretKeys = new Set(
    [...ubuntuCompose.matchAll(/\$\{([A-Z][A-Z0-9_]*):\?set [^}]+\}/g)].map(
      match => match[1]
    )
  );
  const completionDefaults = {
    COMPLETION_PROTOCOL_MODE: 'legacy',
    COMPLETION_WRITES_PAUSED: 'false',
    COMPLETION_STORAGE_CONFIRMED: 'false',
    COMPLETION_RETIREMENT_SERVICE_TOKEN: '',
    COMPLETION_ORPHAN_CLEANUP_ENABLED: 'false'
  };
  assert(
    sameSet(ubuntuTemplateKeys, new Set([...ubuntuRequiredSecretKeys, ...Object.keys(completionDefaults)])),
    'docker-compose.ubuntu.env.example keys differ from Ubuntu Compose required secrets and completion controls',
    errors
  );
  for (const [file, source] of [
    ['docker-compose.ubuntu.env.example', ubuntuEnvironment],
    ['backend/.env.example', read('backend/.env.example')]
  ]) {
    const effective = dotenv.parse(source);
    // Template controls are single-line assignments. Count before parser last-value-wins collapse.
    const declarations = source.split(/\r\n?|\n/).flatMap(line => Object.keys(dotenv.parse(line)));
    for (const [key, value] of Object.entries(completionDefaults)) {
      assert(declarations.filter(name => name === key).length === 1,
        `${file} must declare ${key} exactly once`, errors);
      assert(effective[key] === value, `${file} must default ${key}=${value}`, errors);
    }
  }

  for (const requiredText of [
    'npm run release:family',
    'Node.js 22',
    'Docker Compose',
    'release-gate-artifacts',
    '不删除持久卷'
  ]) {
    assert(
      deployment.includes(requiredText),
      `deployment guide is missing ${requiredText}`,
      errors
    );
  }

  if (errors.length > 0) {
    throw new Error(`Family documentation gate failed:\n- ${errors.join('\n- ')}`);
  }

  return {
    documents: documents.size,
    proposedAiDocuments: aiDocuments.size,
    proposedSelfDirectedDocuments: selfDirectedDocuments.size,
    selfDirectedContractProbes,
    valueGateContractProbes: valueGateTextRules.length + valueGateExamples.length + valueGateStructuralMutants.length,
    proposedAiContracts: proposedAiContracts.length,
    contractFixtureCases,
    requirements: productIds.size
  };
}

if (require.main === module) {
  try {
    const result = validate();
    process.stdout.write(
      `Family documentation gate passed: ${result.documents} baseline documents, ` +
        `${result.proposedSelfDirectedDocuments} proposed self-directed-learning documents, ` +
        `${result.selfDirectedContractProbes} self-directed contract probes, ` +
        `${result.valueGateContractProbes} value-gate text probes, ` +
        `${result.proposedAiDocuments} proposed AI documents, ` +
        `${result.proposedAiContracts} AI contracts, ` +
        `${result.contractFixtureCases} contract fixture cases, ` +
        `${result.requirements} requirements.\n`
    );
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  authoritativeDocuments,
  proposedAiDocuments,
  proposedSelfDirectedDocuments,
  proposedAiContracts,
  requirementIds,
  validate
};
