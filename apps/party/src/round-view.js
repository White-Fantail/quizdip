// React-style identity check for the static game board. Keep the same DOM
// through a question's playing -> revealed transition, but rebuild for the
// next question, a restarted run, or a changed locale/question.
export function sameRoundView(previous,next){
 return Boolean(previous&&next&&
  previous.game===next.game &&
  previous.question===next.question &&
  previous.round===next.round &&
  previous.locale===next.locale);
}
