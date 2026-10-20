import { createHash,timingSafeEqual } from "node:crypto";
import { db } from "../../../../src/modules/platform/db";

export const runtime="nodejs",dynamic="force-dynamic";
const responseHeaders={"Cache-Control":"no-store"};

/** Daily expiration, not a 30-minute deletion: a user's answers may still be
 * waiting in offline browser storage. Only the original expiresAt is terminal.
 * CRON_SECRET is required even if Vercel cron is enabled.
 */
export async function GET(request:Request){
  const secret=process.env.CRON_SECRET;
  if(!secret||secret.length<32)
    return Response.json({error:"not_configured"},{status:503,headers:responseHeaders});
  const supplied=request.headers.get("authorization");
  const value=supplied?.startsWith("Bearer ")?supplied.slice(7):"";
  const actual=createHash("sha256").update(value).digest();
  const expected=createHash("sha256").update(secret).digest();
  if(!value||!timingSafeEqual(actual,expected))
    return Response.json({error:"unauthorized"},{status:401,headers:responseHeaders});
  try{
    const result=await db().playRun.updateMany({
      where:{status:"ACTIVE",expiresAt:{lte:new Date()}},
      data:{status:"EXPIRED"}
    });
    return Response.json({expired:result.count},{headers:responseHeaders});
  }catch(error){
    console.error("[QuizDip] run expiration cleanup failed",error);
    return Response.json({error:"cleanup_failed"},{status:500,headers:responseHeaders});
  }
}
