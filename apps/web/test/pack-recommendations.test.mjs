import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseOperation,operations} from "../src/modules/platform/contracts.ts";
import {rankRelatedPacks,titleTokens} from "../src/modules/platform/pack-recommendation-ranking.ts";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const id="94f0792a-18e6-40c0-a480-0be6d46dbb37";
const id2="94f0792a-18e6-40c0-a480-0be6d46dbb38";
const id3="94f0792a-18e6-40c0-a480-0be6d46dbb39";
const source={id,authorId:"author",title:"Wonpil basic quiz",quizIds:["q1"],topicIds:["day6"]};
const candidate=(id,props={})=>({id,title:id,authorId:"someone",quizIds:[],topicIds:[],plays:0,updatedAt:0,...props});
test("manual links precede similar and popular candidates",()=>{
  const ranked=rankRelatedPacks(source,[
    candidate(id2,{title:"Wonpil advanced",topicIds:["day6"]}),
    candidate(id3,{title:"Unrelated",plays:3000})
  ],[id3],[]);
  assert.deepEqual(ranked.map(x=>x.id),[id3,id2]);
});
test("unplayed packs are preferred to completed; self excluded",()=>{
  assert.deepEqual(rankRelatedPacks(source,[candidate(id),candidate(id2,{topicIds:["day6"]}),candidate(id3)],[],[id2]).map(x=>x.id),[id3,id2]);
  assert.ok(titleTokens("원필 심화편 퀴즈").includes("원필"));
});
test("recommendation contracts reject self duplicate inputs and invalid tracking",()=>{
  assert.equal(operations.pack_recommendations.public,true);
  assert.equal(operations.pack_recommendations_set.public,false);
  assert.equal(operations.pack_recommendation_track.public,true);
  assert.throws(()=>parseOperation("pack_recommendations_set",{id,packIds:[id2,id2]}));
  assert.throws(()=>parseOperation("pack_recommendations_set",{id,packIds:[id2,id3,id2,id3]}));
  assert.deepEqual(parseOperation("pack_recommendations_set",{id,packIds:[]}).packIds,[]);
  assert.throws(()=>parseOperation("pack_recommendation_track",{runId:id,runToken:"x",kind:"CLICK",targetPackIds:[id2]}));
  assert.equal(parseOperation("pack_recommendations",{id,locale:"ko"}).limit,3);
  assert.throws(()=>parseOperation("pack_recommendations",{id,locale:"ko",limit:4}));
});
test("all new operations share REST and MCP; link edits preserve Kids moderation",()=>{
  const routes=read("app/api/v1/[...segments]/route.ts");
  const ops=read("src/modules/platform/operations.ts");
  const service=read("src/modules/platform/pack-recommendations.ts");
  const player=read("app/(platform)/play/page.tsx");
  for(const operation of ["pack_recommendations","pack_recommendations_set","pack_recommendation_track"]){
    assert.match(routes,new RegExp('op:\\s*"'+operation+'"'));
    assert.match(ops,new RegExp('case "'+operation+'"'));
  }
  assert.match(read("app/api/mcp/route.ts"),/Object\.keys\(operations\)/);
  assert.match(service,/safePack\(candidate\.id,locale,"GENERAL"\)/);
  assert.match(service,/checkedRun\(p\.runId,p\.runToken,actor\)/);
  assert.match(service,/skipDuplicates:true/);
  assert.doesNotMatch(service,/kidsEligible:false|kidsReviewStatus:"NOT_REQUESTED"/);
  assert.match(player,/run\.status==="FINISHED"&&confirmedRunId===run\.runId/);
  assert.match(read("app/(creator)/studio/packs/pack-editor.tsx"),/PackRecommendationEditor/);
  assert.match(read("../../prisma/schema.prisma"),/model PackRecommendationEvent/);
});
