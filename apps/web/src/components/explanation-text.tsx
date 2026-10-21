import { Fragment } from "react";
import { explanationSegments } from "../modules/quiz/explanation-links";

/** Shared read-only explanation renderer for gameplay and Studio preview. */
export function ExplanationText({text}:{text:string}) {
  return <p className="quiz-explanation-content">
    {explanationSegments(text).map((part,index)=>part.href
      ? <a key={index} href={part.href} target="_blank" rel="noopener noreferrer">{part.text}</a>
      : <Fragment key={index}>{part.text}</Fragment>)}
  </p>;
}
