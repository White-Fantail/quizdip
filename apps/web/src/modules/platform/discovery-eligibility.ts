/** Mirror the domain rule without weakening publication, locale, media or moderation gates.
 * A zero-clue multiple-choice quiz is playable; zero-clue free text is not. */
export function hasPlayableDiscoveryClues(clues:unknown,answer:unknown):clues is unknown[] {
  if(!Array.isArray(clues))return false;
  if(clues.length>0)return true;
  if(!answer||typeof answer!=="object"||Array.isArray(answer))return false;
  const a=answer as {responseMode?:unknown;options?:unknown};
  return a.responseMode==="multiple-choice"&&Array.isArray(a.options)&&a.options.length>=2;
}
