const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');
const root = '/Users/REDACTED/GitHub PRJ/LMS';
const out = path.join(root, 'release-gate-artifacts/t7-docker-isolation-r5-2026-10-28');
fs.mkdirSync(out);
const run = 'family-growth-isolated-t7-' + crypto.randomBytes(4).toString('hex');
const dest = '/home/REDACTED/' + run;
const local = fs.mkdtempSync('/private/tmp/t7-isolation-');
const src = path.join(local, 'src'); fs.mkdirSync(src);
const files = cp.execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: root }).toString().split('\0').filter(Boolean);
const selected = [...new Set(files)].filter(f =>
  (f.startsWith('backend/') && !/(^|\/)(node_modules|__tests__|tests?|coverage|uploads|logs)(\/|$)/.test(f)
    && (/\.(js|json)$/.test(f) || /\/Dockerfile$/.test(f)))
  || ['package.json','package-lock.json','.dockerignore','docker-compose.family.yml',
    'scripts/release-family-gate.sh','scripts/check-release-isolation.js','scripts/compose-family-smoke.js','scripts/run-isolated-compose-smoke.sh',
    'scripts/completion-operations.js'].includes(f));
const manifest = [];
for (const file of selected.sort()) {
  const stat = fs.lstatSync(path.join(root,file));
  if (!stat.isFile() || /(^|\/)(\.env|\.aws|\.ssh)|\.(pem|key|log)$/.test(file)) throw new Error('unsafe path');
  const bytes = fs.readFileSync(path.join(root,file));
  fs.mkdirSync(path.dirname(path.join(src,file)), { recursive:true }); fs.writeFileSync(path.join(src,file),bytes);
  manifest.push({path:file,size:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
}
const yaml = require(path.join(root, 'node_modules/js-yaml'));
class Override extends Array {}
const tag = new yaml.Type('!override', {kind:'sequence',instanceOf:Override,represent:value=>Array.from(value)});
const schema = yaml.Schema.create([tag]);
const names = ['gateway','user-service','progress-service','homework-service','resource-service','analytics-service','notification-service'];
const services = {};
for(const name of names) services[name] = {image:`${run}-${name}:candidate`,cpus:0.2,mem_limit:'256m',memswap_limit:'256m',pids_limit:128};
services.gateway.ports = new Override({target:3000,published:'${FAMILY_GATEWAY_HOST_PORT}',host_ip:'127.0.0.1',protocol:'tcp'});
services.mongo = {image:'mongo@sha256:4be76f674fc4b27859816811b8baa3c51830eb1dbf4ca81a51e26b79edd662ef',
  cpus:0.4,mem_limit:'896m',memswap_limit:'896m',pids_limit:128,ports:new Override(),volumes:['mongo-config:/data/configdb']};
services['mongo-init'] = {image:services.mongo.image,cpus:0.1,mem_limit:'128m',memswap_limit:'128m',pids_limit:64,
  tmpfs:['/data/db:size=1048576','/data/configdb:size=1048576']};
fs.writeFileSync(path.join(local,'override.yml'),yaml.dump({services,volumes:{'mongo-config':{}}},{schema,noRefs:true}));
fs.writeFileSync(path.join(out,'source-manifest.json'),JSON.stringify({run,dest,base:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root}).toString().trim(),files:manifest},null,2)+'\n');
fs.copyFileSync(path.join(out,'source-manifest.json'),path.join(local,'source-manifest.json'));
fs.writeFileSync(path.join(out,'entry.patch'),cp.execFileSync('git',['diff','--','scripts/release-family-gate.sh'],{cwd:root}));
fs.writeFileSync(path.join(local,'run.json'),JSON.stringify({run,dest,local,src,out}));
cp.execFileSync('tar',['--no-xattrs','-czf',path.join(local,'source.tar.gz'),'-C',local,'src','override.yml','source-manifest.json'],
  {env:{...process.env,COPYFILE_DISABLE:'1'}});
console.log(JSON.stringify({run,dest,local,count:manifest.length,bytes:manifest.reduce((n,r)=>n+r.size,0)}));
