import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseOperation } from "../src/modules/platform/contracts.ts";
import { rotatedCatalogOffset,mixDiscoveryCards } from "../src/modules/platform/discovery-mix.ts";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("rotating catalog windows stay in bounds, remain stable and reach older content",()=>{
  assert.equal(rotatedCatalogOffset(80,100,60,100,0),100);
  assert.equal(rotatedCatalogOffset(160,100,60,100,0),100);
  assert.equal(rotatedCatalogOffset(520,100,60,100,0),rotatedCatalogOffset(520,100,60,100,0));
  const offsets=new Set(Array.from({length:7},(_,i)=>rotatedCatalogOffset(520,100,60,100,i)));
  assert.ok(offsets.size>=5);
  for(const offset of offsets)assert.ok(offset>=100&&offset+60<=520);
  assert.deepEqual(parseOperation("discover_sections",{}),{locale:"en",rotation:0});
  assert.equal(parseOperation("discover_sections",{rotation:5}).rotation,5);
  assert.throws(()=>parseOperation("discover_sections",{rotation:1001}));
});

test("surprise selection is deterministic, mixed, unique and author-balanced",()=>{
  const rows=Array.from({length:30},(_,i)=>({
    id:String(i),type:i%2===0?"PACK":"QUIZ",creator:"author-"+(i%6)
  }));
  const a=mixDiscoveryCards(rows,20752,0);
  const b=mixDiscoveryCards(rows,20752,0);
  assert.deepEqual(a,b);
  assert.equal(a.length,6);
  assert.equal(new Set(a.map(x=>x.type+":"+x.id)).size,a.length);
  assert.ok(a.some(x=>x.type==="PACK")&&a.some(x=>x.type==="QUIZ"));
  assert.ok(new Set(Array.from({length:8},(_,i)=>mixDiscoveryCards(rows,20752,i).map(x=>x.id).join(","))).size>1);
  for(const count of new Set(a.map(x=>x.creator)))
    assert.ok(a.filter(x=>x.creator===count).length<=2);
  assert.equal(mixDiscoveryCards([],20752,0).length,0);
});

test("sampling retains publication, moderation, media and language gates",()=>{
  const code=read("src/modules/platform/discovery.ts");
  assert.match(code,/playableQuizWhere\(locale\)/);
  assert.match(code,/safetyStatus:"ACTIVE"/);
  assert.match(code,/moderationStatus:"APPROVED"/);
  assert.match(code,/const featured=rows.filter\(r=>!r.bad\)/);
  assert.match(code,/key:"surprise"/);
  assert.match(code,/mixDiscoveryCards\(featured.map/);
  assert.match(read("app/api/v1/[...segments]/route.ts"),/discover_sections/);
  assert.match(read("src/modules/platform/operations.ts"),/case "discover_sections": return discoverSections\(p\)/);
});
