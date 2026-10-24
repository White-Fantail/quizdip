import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { uniqueDiscoveryRows } from "../app/(platform)/discover/discovery-layout.ts";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("Discover cards do not repeat across featured or organic lanes",()=>{
 const mk=(key,ids)=>({key,items:ids.map(([type,id])=>({type,id}))});
 const sections=[
   mk("surprise",[["PACK","a"],["PACK","b"],["QUIZ","x"],["QUIZ","y"]]),
   mk("popular",[["PACK","a"],["QUIZ","x"],["PACK","c"],["QUIZ","z"]]),
   mk("new",[["PACK","c"],["QUIZ","z"],["QUIZ","q"]])
 ];
 const chosen=uniqueDiscoveryRows(sections,["PACK:b","QUIZ:y"],2);
 assert.deepEqual(chosen.map(s=>s.items.map(x=>x.id)),[["a","x"],["c","z"],["q"]]);
 assert.deepEqual(new Set(chosen.flatMap(s=>s.items.map(x=>x.type+":"+x.id))).size,5);
 assert.deepEqual(uniqueDiscoveryRows(sections,["PACK:a","PACK:b","PACK:c","QUIZ:x","QUIZ:y","QUIZ:z","QUIZ:q"]),[]);
});

test("Remix uses shared REST/MCP operation with an optional validated rotation",()=>{
 const client=read("app/(platform)/discover/discovery-client.ts");
 const page=read("app/(platform)/discover/page.tsx");
 const ranked=read("app/(platform)/discover/discovery-sections.tsx");
 const spot=read("app/(platform)/discover/pack-spotlight.tsx");
 assert.match(client,/&rotation=" \+ rotation/);
 assert.match(client,/inFlight\.get\(key\)/);
 assert.match(page,/onRemix=\{\(\)=>setRotation/);
 assert.match(page,/excludedIds=\{\[\.\.\.spotlightIds,\.\.\.editorialIds\]\}/);
 assert.match(ranked,/uniqueDiscoveryRows\(eligible,excludedIds,3\)/);
 assert.match(ranked,/not a popularity ranking/);
 assert.match(spot,/const surprise = packSection\("surprise"\)/);
 assert.match(spot,/onSelected\(selected.map/);
 assert.match(read("app/(platform)/discover/editorial-highlights.tsx"),/onSelected\(picks.map/);
});
