# 本地校验与自查记录

日期：2026-11-02。主执行线程自查，不冒称独立复评、Provider执行或模型效果验收。

## 实际执行

1. 从本对话已批准适配稿直接提取system与三组user JSON，与inputs.json逐字/结构比较：PASS。
2. 使用现有ai1Contract.normalize/create及buildPreview纯函数重建完整messages与Provider正文：
   3组全部PASS，输入规范化前后内容相同；2项归档文件hash及每组system/user/messages/body摘要、
   UTF-8字节数全部一致；当前矩阵68项源码指纹一致。
3. 现有Node22及既有依赖执行 `node scripts/check-family-docs.js`：exit0。
   23 baseline / 4 self-directed documents / 16 contract probes / 35 value probes /
   8 AI documents / 23 AI contracts / 412 fixtures / 38 requirements。
4. 同一环境执行既有文档矩阵定向测试：
   `jest --config=backend/jest.family-common.config.js --runInBand --coverage=false --runTestsByPath backend/common/deployment/__tests__/familyDocumentationGate.test.js --testNamePattern='AI-1 (cross-layer progress|current matrix)' --silent --verbose=false`
   exit0，1 suite passed、2 tests passed、311未选（Jest显示skipped）；不是313项全跑或新增业务全量证据。
5. 文档更新后再次运行上述状态校验及定向测试，结果相同；git diff --check通过。
   新增5个归档文件的末尾换行、尾空白、Markdown围栏及5条相对文件链接检查通过。

既有依赖通过NODE_PATH解析，未安装包。buildPreview只使用明确的合成profile、固定时钟和测试单价，
只比较消息与正文；该profile未归档为生产报价，未据此计算或宣称本轮获准费用。
未实例化Provider、计数器、HTTP客户端或运行DeepTutor。Provider字段与ai1_provider.py prepare源码静态比对，
未将此比对冒称跨语言真实网络验收。所有原始命令输出留在本对话工具记录。

## 可重复的本地冻结核对

在LMS仓库根目录，设置NODE_PATH为已安装的依赖目录、DEEPTUTOR_ROOT为本地DeepTutor检出，
使用已有Node22执行以下代码。仅读文件并调用现有纯函数，无网络和模型调用。

```javascript
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {canonicalize}=require('json-canonicalize');
const C=require('./backend/services/homework-service/services/ai1Contract');
const dir='docs/development/evidence/ai1-inputs-20261102';
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8'));
const m=read('manifest.json'),i=read('inputs.json'),r=read('requests.json');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
for(const [file,digest] of Object.entries(m.files))assert.equal(sha(fs.readFileSync(path.join(dir,file))),digest);
assert.equal(r.groups.length,3);assert.equal(i.groups.length,3);assert.equal(m.requests.length,3);
assert.deepEqual(i.groups.map(g=>g.id),['concept','mistake','application']);
const now=Date.parse('2026-11-02T00:00:00Z');
const profile={model:i.modelCandidate,modelProfileVersion:'synthetic-validation-only',pricingProfileVersion:'synthetic-validation-only',callWindowMs:1000,clockMarginMs:1000,checkedAt:new Date(now).toISOString(),expiresAt:new Date(now+60000).toISOString(),inputPriceMicrosPerMillion:1,outputPriceMicrosPerMillion:1};
for(let n=0;n<3;n++){
 const g=i.groups[n],wire=r.groups[n],hashes=m.requests[n];
 assert.equal(g.id,wire.id);assert.equal(g.id,hashes.id);
 const cmd=C.normalize('create',{schemaVersion:'ai1-min-v1',operationId:'11111111-1111-4111-8111-111111111111',childId:'aaaaaaaaaaaaaaaaaaaaaaaa',source:{type:g.id==='mistake'?'mistake':'task',id:'bbbbbbbbbbbbbbbbbbbbbbbb'},...g.user,deidentifiedConfirmed:true});
 assert.deepEqual({chapter:cmd.chapter,input:cmd.input},g.user);
 const preview=C.buildPreview(cmd,profile,now);
 assert.equal(preview.messages[0].content,i.system);assert.equal(preview.messages[1].content,canonicalize(g.user));
 const body={model:i.modelCandidate,messages:preview.messages,max_tokens:4096,stream:false,thinking:{type:'disabled'}};
 assert.equal(wire.wireBodyUtf8,canonicalize(body));
 assert.equal(sha(wire.wireBodyUtf8),hashes.wireBodySha256);
 assert.equal(Buffer.byteLength(wire.wireBodyUtf8),hashes.wireBodyUtf8Bytes);
 assert.equal(sha(i.system),hashes.systemSha256);
 assert.equal(sha(preview.messages[1].content),hashes.userSha256);
 assert.equal(sha(canonicalize(preview.messages)),hashes.messagesSha256);
}
const ref=path.join(dir,m.implementationReference.manifest);
assert.equal(sha(fs.readFileSync(ref)),m.implementationReference.sha256);
const matrix=JSON.parse(fs.readFileSync(ref,'utf8'));
for(const f of matrix.sourceFingerprints){
 const root=f.repo==='LMS'?process.cwd():process.env.DEEPTUTOR_ROOT;
 assert.ok(root,'DEEPTUTOR_ROOT is required for source verification');
 assert.equal(sha(fs.readFileSync(path.join(root,f.path))),f.sha256,f.repo+':'+f.path);
}
console.log('PASS: 2 artifact hashes; 3 unchanged normalized inputs; 3 production preview message pairs; 3 full canonical bodies and all per-group hashes; '+matrix.sourceFingerprints.length+' source fingerprints.');
```

## 自查结论与未执行项

- 新增归档仅承载已批准合成文字、完整正文、差异及摘要，不包含凭据、真实学习内容、私有路径或可执行发送信封。
- 原批准草案和旧压缩封装的摘要口径分开；本候选为新批准适配，不假冒原文件复原。
- 标准答案仅用于README人工核对，不注入system/user；所有练习/变式题要求明确删除。
- SHA256是字节完整性校验，不是token计数、供应商计费上界、数学质量或运行权限证明。
- 真实报价及额度、计数资格、完整运行信封、原Job恢复链和人工输出验收仍须按测试方案§17.3执行。
- 未改变产品/测试实现；未重跑前后端完整回归，历史失败与定向通过继续分开保留。
- 候选待用户复审，B/D/AI-1 OPEN及全部未关闭/后置状态不变。
