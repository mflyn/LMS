#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..');
const authoritativeDocuments = [
  'README.md',
  'docs/README.md',
  'docs/development/README.md',
  'docs/product/family-learning-tracker.md',
  'docs/architecture/family-learning-tracker-architecture.md',
  'docs/architecture/sequence-diagrams.md',
  'docs/api/family-learning-tracker-api.md',
  'docs/development/family-growth-requirement-traceability.md',
  'docs/development/family-growth-design-asset-index.md',
  'docs/development/family-growth-baseline-v1.6-manifest.md',
  'docs/development/family-growth-v1.6-release-gate.md',
  'docs/development/family-growth-mistake-pdf-multi-attachments-gate.md',
  'docs/deployment/README.md',
  'docs/deployment/local-ubuntu-deployment.md',
  'docs/user-guide/README.md',
  'docs/user-guide/quick-start.md',
  'docs/user-guide/parent-guide.md',
  'docs/user-guide/child-guide.md'
];

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

function validate() {
  const errors = [];
  const documents = new Map();

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
  const ubuntuEnvironment = read('docker-compose.ubuntu.env.example');
  const ubuntuCompose = read('docker-compose.ubuntu.yml');

  for (const [relativePath, markdown] of [
    ['docs/product/family-learning-tracker.md', product],
    ['docs/architecture/family-learning-tracker-architecture.md', architecture],
    ['docs/api/family-learning-tracker-api.md', api]
  ]) {
    assert(
      markdown.includes('**Baseline candidate:** FGT-MVP-1.6'),
      `${relativePath}: baseline candidate must be FGT-MVP-1.6`,
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
  assert(productIds.size === 35, `PRD requirement count is ${productIds.size}, expected 35`, errors);
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
  assert(
    traceabilityRows.every(line => line.includes('| COVERED |')),
    'every traceability row must be COVERED',
    errors
  );
  assert(
    traceability.includes('**Document status:** READY_FOR_REVIEW'),
    'traceability status must be READY_FOR_REVIEW',
    errors
  );
  assert(
    traceability.includes('**Implementation conformance:** COVERED (35/35)'),
    'traceability must record 35/35 implementation conformance separately from approval',
    errors
  );
  assert(
    traceability.includes('**Baseline candidate:** FGT-MVP-1.6'),
    'traceability must target FGT-MVP-1.6',
    errors
  );

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

  const ubuntuTemplateKeys = new Set(
    [...ubuntuEnvironment.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map(match => match[1])
  );
  const ubuntuRequiredSecretKeys = new Set(
    [...ubuntuCompose.matchAll(/\$\{([A-Z][A-Z0-9_]*):\?set [^}]+\}/g)].map(
      match => match[1]
    )
  );
  assert(
    sameSet(ubuntuTemplateKeys, ubuntuRequiredSecretKeys),
    'docker-compose.ubuntu.env.example keys differ from Ubuntu Compose required secrets',
    errors
  );

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
    requirements: productIds.size
  };
}

if (require.main === module) {
  try {
    const result = validate();
    process.stdout.write(
      `Family documentation gate passed: ${result.documents} documents, ` +
        `${result.requirements} requirements.\n`
    );
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  authoritativeDocuments,
  requirementIds,
  validate
};
