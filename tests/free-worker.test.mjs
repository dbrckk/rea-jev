import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectType, planAnalysis, buildReport } from '../src/free-worker.mjs';

test('detects actual binary signatures rather than trusting file names', () => {
  const dir=mkdtempSync(join(tmpdir(),'rea-detect-'));
  try{
    for (const [name,body,type] of [
      ['foo.exe',Buffer.from([0x4d,0x5a,0x00,0x00]),'pe'],
      ['foo.apk',Buffer.from([0x50,0x4b,0x03,0x04]),'apk'],
      ['foo.apk',Buffer.from('not-a-zip'),'unknown'],
      ['foo.elf',Buffer.from([0x7f,0x45,0x4c,0x46]),'elf'],
      ['model.gguf',Buffer.from('GGUF'),'model']
    ]) {
      const p=join(dir,'case-'+name);
      writeFileSync(p,body);
      assert.equal(detectType(p,name),type);
    }
  } finally {rmSync(dir,{recursive:true,force:true});}
});
test('routes static REA work according to format and question',()=>{
  assert.deepEqual(planAnalysis('apk','permissions').map(x=>x.command), ['inspect-artifact','identify-flutter-build']);
  assert.deepEqual(planAnalysis('pe','certificat Authenticode').map(x=>x.command), ['inspect-pe-imports','inspect-binary-layout','inspect-pe-certificates','inspect-artifact']);
  assert.equal(planAnalysis('sqlite','tables')[0].command,'inspect-sqlite-database');
});
test('report attributes real REA evidence, marks missing observations and excludes fake Jev',()=>{
  const report=buildReport({filename:'case.exe',size:4,sha256:'1'.repeat(64),type:'pe',
    question:'imports',outcomes:[{command:'inspect-pe-imports',description:'Imports',ok:true,data:{ evidence_id:'ev_42',format:'PE' }},
      {command:'inspect-artifact',description:'Conteneur',ok:false,error:'unsupported format'}]});
  assert.match(report,/ev_42/);
  assert.match(report,/Non vérifié/);
  assert.match(report,/Jev \/ OpenJev : non connecté/);
});
