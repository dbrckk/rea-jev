import test from 'node:test';
import { projectEvidence } from '../src/evidence.mjs';
import assert from 'node:assert/strict';
import {
  jevConfiguration, requestJev, choosePlan, gateInspection, reviewEvidence, evaluateCompleteness, probeJev
} from '../src/openjev.mjs';

const cfg = {
  enabled:true, provider:'codiv', base:'https://api.codiv.ai', model:'openjev-0.1', credential:'test-server-secret'
};
function fakeJev(calls) {
  return async (url, request) => {
    assert.equal(url, 'https://api.codiv.ai/v1/systemone');
    assert.equal(request.method, 'POST');
    assert.equal(request.headers.Authorization, 'Bearer test-server-secret');
    const body=JSON.parse(request.body);
    assert.equal(body.model, 'openjev-0.1');
    assert.ok(body.questions);
    calls.push(body);
    const answers={};
    for (const [name,q] of Object.entries(body.questions)) {
      if (q.type === 'choice') {
        answers[name]={type:'choice', choice:'step1', confidence:0.8,
          probabilities: {step0:0.1,step1:0.9}};
      } else {
        answers[name]={type:'noul', noul:name === 'injected' ? 0.03 : 0.94};
      }
    }
    return {ok:true,json:async()=>({model:'openjev-0.1',answers,usage:{input_tokens:111}})};
  };
}

test('no credentials is not silently mistaken for functioning Jev',()=>{
  const free=jevConfiguration({});
  assert.equal(free.enabled,false);
  assert.equal(free.availability,'server-key-missing');
  const notPaid=jevConfiguration({REA_JEV_PROVIDER:'typesafe', TYPESAFE_API_KEY:'xyztestxyztest'});
  assert.equal(notPaid.enabled,false);
  assert.equal(notPaid.availability,'paid-provider-not-authorized');
  const paid=jevConfiguration({REA_JEV_PROVIDER:'typesafe',REA_JEV_ALLOW_PAID:'1',TYPESAFE_API_KEY:'xyztestxyztest'});
  assert.equal(paid.enabled,true);
  assert.equal(paid.model,'jev-latest');
});
test('real Jev wire format: route, gate, evidence and completeness',async()=>{
  const calls=[], log=[], decisions=[], options={configuration:cfg, fetcher:fakeJev(calls)};
  const plan=[{command:'inspect-artifact',description:'Inventaire'},
    {command:'inspect-binary-layout',description:'Sections'}];
  const ordered=await choosePlan(plan,{type:'pe',question:'Analyser les sections'},
    s=>log.push(s), decisions,options);
  assert.equal(ordered[0].command,'inspect-binary-layout');
  assert.equal(await gateInspection(plan[0],{type:'pe',question:'Analyse'},()=>{},decisions,options),true);
  await reviewEvidence({command:'inspect-artifact',ok:true,data:{evidence_id:'test123'}},
    {question:'Comprendre le format'},()=>{},decisions,options);
  assert.equal(await evaluateCompleteness({question:'Inventaire',outcomes:[{command:'inspect-artifact',ok:true,data:{evidence_id:'test123'}}]},
    ()=>{},decisions,options),0.94);
  assert.deepEqual(decisions.map(d=>d.stage),['route','gate','evidence','completeness']);
  assert.equal(decisions.filter(d=>d.model).length,4);
  assert.equal(calls.length,4);
  assert.equal(calls[2].questions.injected.type,'noul');
});
test('fake confidence cannot claim a working Jev result',async()=>{
  const options={configuration:cfg,fetcher:async()=>({ok:true,json:async()=>({answers:{priority:{type:'choice',choice:'malicious-tool',confidence:1}}})})};
  const plan=[{command:'inspect-artifact',description:'Static'}, {command:'inspect-binary-layout',description:'Layout'}];
  const decisions=[];
  const out=await choosePlan(plan,{type:'pe',question:'Inspect'},()=>{},decisions,options);
  assert.deepEqual(out,plan);
  assert.equal(decisions[0].stage,'route');
  assert.match(decisions[0].error,/invalide/);
});
test('API failure falls back to static rules; no model success is invented',async()=>{
  const options={configuration:cfg,fetcher:async()=>({ok:false,status:429})};
  const decisions=[];
  const plan=[{command:'inspect-artifact',description:'Static'}, {command:'inspect-binary-layout',description:'Layout'}];
  assert.deepEqual(await choosePlan(plan,{type:'pe',question:'Inspect'},()=>{},decisions,options),plan);
  assert.equal(decisions[0].error,'HTTP 429');
  assert.equal(await gateInspection(plan[0],{type:'pe',question:'Inspect'},()=>{},decisions,options),true);
});
test('Jev cannot command execution or change static command allowlist',async()=>{
  const decisions=[];
  const fake=async()=>({ok:true,json:async()=>({answers:{in_scope:{type:'noul',noul:0.02}}})});
  assert.equal(await gateInspection({command:'capture-process'}, {type:'apk',question:'Analyze'},
    ()=>{},decisions,{configuration:cfg,fetcher:fake}),false);
  assert.equal(await gateInspection({command:'rm -rf'}, {type:'apk',question:'Analyze'},
    ()=>{},decisions,{configuration:cfg,fetcher:fake}),false);
  // A low Jev opinion cannot veto safe passive reads or replace deterministic safety policy.
  assert.equal(await gateInspection({command:'inspect-artifact'}, {type:'apk',question:'Analyze'},
    ()=>{},decisions,{configuration:cfg,fetcher:fake}),true);
});

test('readiness verifies genuine System One request; never claims success on unauthorized response',async()=>{
  const ok = await probeJev({ configuration:cfg, fetcher:fakeJev([]) });
  assert.equal(ok.connected,true);
  assert.equal(ok.checked,true);
  assert.equal(ok.model,'openjev-0.1');
  const no = await probeJev({ configuration:cfg, fetcher:async()=>({ok:false,status:401}) });
  assert.equal(no.connected,false);
  assert.equal(no.reason,'HTTP 401');
  const absent = await probeJev({configuration:{enabled:false,availability:'server-key-missing'}});
  assert.equal(absent.checked,false);
  assert.equal(absent.connected,false);
});

test('Jev reads actual nested REA normalized evidence, never raw local paths or secrets', async () => {
  const canonical = {
    evidence_id:'ev_main',
    subject:{ local_path:'/home/private/app.apk', format:'apk' },
    raw_result:{ api_key:'private-do-not-send' },
    normalized_result:{
      subject:{root_format:'apk'},
      substeps:[{operation:'inventory_artifact',status:'completed',evidence:{
        evidence_id:'ev_child',
        normalized_result:{ manifest:{node_count:3,root_format:'apk'},
          nodes:[{format:'dex',local_path:'/private/classes.dex',content_state:'embedded'}] },
        limitations:[]
      }}]
    },
    limitations:[{message:'Only static evidence available'}]
  };
  const projected = projectEvidence(canonical);
  const serialized = JSON.stringify(projected);
  assert.match(serialized,/inventory_artifact|node_count/);
  assert.match(serialized,/ev_child/);
  assert.doesNotMatch(serialized,/\/home\/private|\/private\/classes|private-do-not-send/);
  assert.ok(serialized.length < 5500);
  const calls=[];
  const fetcher=async (url, options)=>{
    const body=JSON.parse(options.body);
    calls.push(body);
    return fakeJev([])(url,options);
  };
  const decisions=[];
  await reviewEvidence({command:'inspect-artifact',ok:true,data:canonical},
    {question:'APK inventory'},()=>{},decisions,{configuration:cfg,fetcher});
  assert.equal(decisions[0].stage,'evidence');
  assert.match(JSON.stringify(calls[0]),/node_count/);
  assert.doesNotMatch(JSON.stringify(calls[0]),/private-do-not-send|\/home\/private/);
});
