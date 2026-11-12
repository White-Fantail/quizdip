import type { Locale } from "../../i18n/core";
import { PlatformError } from "./auth";
import { safeQuiz } from "./feature-eligibility";
import { quizList } from "./quiz";

export type PublicQuizPreview={id:string;title:string;prompt:string};

/** Server-visible discovery previews: published revision metadata only.
 * Recheck playability, approved media and moderation before rendering.
 * No answer keys, hidden clues or draft data are selected for the response.
 */
export async function publicDiscoverPreview(locale:Locale,limit=6):Promise<PublicQuizPreview[]>{
  const catalog=await quizList({locale,mine:false,kids:false,offset:0,limit:60},null);
  const candidates=catalog.items.filter(q=>typeof q.prompt==="string"&&q.prompt.trim().length>=12);
  // Daily packs are often published as runs of 20 related questions. Sample
  // across the recent catalog rather than showing six adjacent same-topic rows.
  const spaced=candidates.filter((_,index)=>index%10===0);
  const ordered=[...spaced,...candidates.filter((_,index)=>index%10!==0)];
  const selected:PublicQuizPreview[]=[];
  for(let offset=0;offset<ordered.length&&selected.length<limit;offset+=4){
    const checked=await Promise.all(ordered.slice(offset,offset+4).map(async quiz=>{
      try{
        await safeQuiz(quiz.id,locale,"GENERAL");
        return {id:quiz.id,title:quiz.title,prompt:quiz.prompt};
      }catch(error){
        if(error instanceof PlatformError&&[404,409].includes(error.status))return null;
        throw error;
      }
    }));
    selected.push(...checked.filter((q):q is PublicQuizPreview=>q!==null));
  }
  return selected.slice(0,limit);
}
