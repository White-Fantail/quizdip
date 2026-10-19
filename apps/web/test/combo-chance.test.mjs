import test from "node:test";
import assert from "node:assert/strict";
import { comboMultiplier, comboAward, comboProgress, initialLocalProgress, guessLocalAnswer, revealLocalClue } from "../../../packages/domain/src/index.ts";

const quiz={quizId:"x",revisionId:"r",title:"Quiz",prompt:"Who?",promptMediaIds:[],
  clues:[{type:"text",text:"clue 1"},{type:"text",text:"clue 2"}],
  answer:{canonical:"Japan",aliases:[],responseMode:"text"}};

test("combo scoring adds five percent per consecutive solve and caps at 25%",()=>{
  assert.equal(comboMultiplier(1),1);
  assert.equal(comboAward(75,2),79);
  assert.equal(comboAward(75,3),83);
  assert.equal(comboAward(75,5),90);
  assert.equal(comboAward(75,6),94);
  assert.equal(comboAward(100,15),125);
});
test("viewing clues does not break the combo",()=>{
  const revealed=revealLocalClue(quiz,initialLocalProgress(2));
  assert.equal(revealed.hadWrongGuess,undefined);
  const result=guessLocalAnswer(quiz,revealed,"Japan",4,true);
  assert.equal(result.progress.hadWrongGuess,false);
  assert.equal(result.result.score,comboAward(20,5));
});
test("wrong guess resets streak; later correct starts at one",()=>{
  const first=guessLocalAnswer(quiz,initialLocalProgress(2),"Mars",5,true);
  assert.equal(first.progress.status,"ACTIVE");
  assert.equal(first.progress.hadWrongGuess,true);
  assert.deepEqual(comboProgress([{status:"SOLVED"},{status:"SOLVED"},{status:"ACTIVE",hadWrongGuess:true}]),{current:0,best:2});
  const second=guessLocalAnswer(quiz,revealLocalClue(quiz,first.progress),"Japan",0,true);
  assert.equal(second.progress.status,"SOLVED");
  assert.equal(second.result.score,20);
  assert.deepEqual(comboProgress([{status:"SOLVED"},{status:"SOLVED"},second.progress]),{current:1,best:2});
});
test("failed question leaves no streak but prior best remains",()=>{
  assert.deepEqual(comboProgress([{status:"SOLVED"},{status:"SOLVED"},{status:"FAILED"}]),{current:0,best:2});
});
