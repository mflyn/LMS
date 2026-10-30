import os, pathlib, subprocess, json, time, signal, shutil, hashlib
root=pathlib.Path('/home/REDACTED/family-growth-isolated-t7-ff969474'); evidence=root/'evidence'
env=json.loads((root/'runner-env.json').read_text());before=json.loads((root/'server-before.json').read_text())
assert json.loads((evidence/'15-result.json').read_text())['exit']==0
compose=['docker','compose','--project-name',root.name,'--file',str(root/'src/docker-compose.family.yml'),
 '--file',str(root/'override.yml'),'--env-file',str(root/'synthetic.env')]
baseline={r['id']:(r['running'],r['started'],r['restarts']) for r in before['containers']}
fmt='{"id":{{json .Id}},"running":{{json .State.Running}},"started":{{json .State.StartedAt}},"restarts":{{json .RestartCount}}}'
previous_swap=None;swap_streak=0
def sample():
 global previous_swap,swap_streak
 m={r.split(':')[0]:int(r.split()[1])*1024 for r in pathlib.Path('/proc/meminfo').read_text().splitlines()}
 free=shutil.disk_usage(root).free
 vm=dict(r.split() for r in pathlib.Path('/proc/vmstat').read_text().splitlines());swap=int(vm['pswpin'])+int(vm['pswpout'])
 swap_streak=swap_streak+1 if previous_swap is not None and swap-previous_swap>1024 else 0;previous_swap=swap
 rows=[json.loads(r) for r in subprocess.check_output(['docker','inspect','--format',fmt,*baseline],text=True).splitlines()]
 current={r['id']:(r['running'],r['started'],r['restarts']) for r in rows}
 reason='EXISTING_CONTAINER_CHANGED' if current!=baseline else None
 if m['MemAvailable']<int(1.5*1024**3):reason='LOW_AVAILABLE_MEMORY'
 if free<max(before['free']-12*1024**3,20*1024**3):reason='DISK_BUDGET'
 if swap_streak>=3:reason='SUSTAINED_SWAP'
 with (evidence/'runtime-budget.jsonl').open('a') as f:f.write(json.dumps({'time':time.time(),'available':m['MemAvailable'],'free':free,'swapPages':swap,'reason':reason})+'\n')
 if reason:raise RuntimeError(reason)
def run(name,args,source=None):
 sample();start=time.time()
 with (evidence/(name+'.log')).open('w') as log:
  with (open(source,'rb') if source else open(os.devnull,'rb')) as inp:
   p=subprocess.Popen(args,cwd=root/'src',env=env,stdin=inp,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
   try:
    while p.poll() is None:sample();time.sleep(2)
   except BaseException:
    os.killpg(p.pid,signal.SIGTERM)
    try:p.wait(timeout=10)
    except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait()
    raise
 with (evidence/'runtime-commands.jsonl').open('a') as f:f.write(json.dumps({'name':name,'args':args,'exit':p.returncode,'seconds':time.time()-start})+'\n')
 print(name+' exit='+str(p.returncode),flush=True)
 if p.returncode:raise RuntimeError(name+'_FAILED')
def config():return json.loads(subprocess.check_output(compose+['config','--format','json'],env=env))
def job(service,name,source,extra=None,cpu='0.4',memory='256m',smoke=False):
 cfg=config()['services'][service];values=cfg.get('environment',{});values.update(extra or {})
 ef=root/(name+'.env');ef.write_text(''.join(str(k)+'='+str(v)+'\n' for k,v in values.items()));ef.chmod(0o600)
 args=['docker','run','--rm','-i','--name',root.name+'-'+name,'--label','lms.isolation.run='+root.name,
  '--label','com.docker.compose.project='+root.name,'--cpus='+cpu,'--memory='+memory,'--memory-swap='+memory,
  '--pids-limit=128','--network',root.name+'_app-network','--env-file',str(ef),'--workdir','/app','--entrypoint','sh' if smoke else 'node']
 if service=='resource-service':
  for v,target in [('resource-data','/var/lib/family-growth/private-media'),('completion-journal','/var/lib/family-growth/completion-journal')]:
   args+=['--mount','type=volume,src='+root.name+'_'+v+',dst='+target]
 if smoke:
  runner=(root/'src/scripts/run-isolated-compose-smoke.sh').read_text()
  args += [root.name+'-'+service+':candidate','-c',runner,'isolated-compose-smoke',hashlib.sha256(source.read_bytes()).hexdigest()]
 else:
  args += [root.name+'-'+service+':candidate','-']
 run(name,args,source)
 ef.unlink()
def stop_owned():
 ids=subprocess.check_output(['docker','ps','-q','--filter','label=com.docker.compose.project='+root.name],text=True).split()
 if ids:
  with (evidence/'failure-stop.log').open('w') as f:
   subprocess.run(['docker','stop',*ids],stdout=f,stderr=subprocess.STDOUT,check=True)
stage=16
try:
 sample()
 run('16-mongo',compose+['up','-d','--no-build','--wait','--wait-timeout','240','mongo'])
 run('16-mongo-init',compose+['run','--rm','--no-deps','mongo-init'])
 job('gateway','16-fresh-database',root/'bootstrap.js',{'SYNTHETIC_BOOTSTRAP_SERVICE':'fresh'})
 for volume in ['resource-data','completion-journal']:
  run('16-volume-'+volume,['docker','volume','create','--label','com.docker.compose.project='+root.name,
   '--label','com.docker.compose.volume='+volume,root.name+'_'+volume])
 for service in ['user','progress','homework','resource','analytics','notification']:
  job(service+'-service','16-index-'+service,root/'bootstrap.js',{'SYNTHETIC_BOOTSTRAP_SERVICE':service})
 job('resource-service','16-storage',root/'storage.js',{'COMPLETION_STORAGE_CONFIRMED':'true'})
 # Only confirm the fresh synthetic mounts after their real sync/publication probes passed.
 values=dict(line.split('=',1) for line in (root/'synthetic.env').read_text().splitlines())
 values['COMPLETION_STORAGE_CONFIRMED']='true'
 (root/'synthetic.env').write_text(''.join(k+'='+v+'\n' for k,v in values.items()))
 for service in ['homework','resource']:
  job(service+'-service','16-preflight-'+service,root/'preflight.js',{'SYNTHETIC_PREFLIGHT_SERVICE':service})
 final=config()
 for s in final['services'].values():
  for key in s.get('environment',{}):
   if 'TOKEN' in key or 'SECRET' in key:s['environment'][key]='REDACTED_SYNTHETIC'
 (evidence/'effective-config-start.redacted.json').write_text(json.dumps(final,indent=2))
 run('16-compose-start',compose+['up','-d','--no-build','--wait','--wait-timeout','240'])
 ids=subprocess.check_output(compose+['ps','-aq'],text=True).split()
 limits=[json.loads(r) for r in subprocess.check_output(['docker','inspect','--format',
  '{"id":{{json .Id}},"name":{{json .Name}},"memory":{{json .HostConfig.Memory}},"memorySwap":{{json .HostConfig.MemorySwap}},"nanoCpus":{{json .HostConfig.NanoCpus}},"state":{{json .State.Status}},"oom":{{json .State.OOMKilled}}}',*ids],text=True).splitlines()]
 assert len(limits)==9 and all(r['memory']>0 and r['memory']==r['memorySwap'] and r['nanoCpus']>0 and not r['oom'] for r in limits)
 assert sum(r['memory'] for r in limits)<=3*1024**3 and sum(r['nanoCpus'] for r in limits)<=2*10**9
 (evidence/'runtime-limits.json').write_text(json.dumps(limits,indent=2))
 (evidence/'16-result.json').write_text(json.dumps({'exit':0,'mode':'enabled','cleanup':False,'healthTimeoutSeconds':240}))
 stage=17
 job('gateway','17-compose-smoke',root/'src/scripts/compose-family-smoke.js',{'FAMILY_GATEWAY_BASE_URL':'http://gateway:3000'},cpu='0.1',memory='128m',smoke=True)
 (evidence/'17-result.json').write_text(json.dumps({'exit':0,'script':'original compose-family-smoke.js, unchanged',
  'route':'isolated project network gateway:3000; no host-network','mode':'enabled'}))
 sample();print('STAGES_14_17_PASSED; full release NOT RUN',flush=True)
except BaseException as error:
 (evidence/(str(stage)+'-result.json')).write_text(json.dumps({'exit':1,'failure':str(error),'laterStages':'NOT_RUN'}))
 stop_owned();print('STOPPED '+str(error),flush=True);raise SystemExit(1)
