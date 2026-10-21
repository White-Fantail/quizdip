import test from "node:test";
import assert from "node:assert/strict";
import { explanationSegments, readableExplanationText } from "../src/modules/quiz/explanation-links.ts";

test("decodes percent-encoded source URLs and keeps the entire link clickable", () => {
  assert.deepEqual(explanationSegments("출처: https%3A%2F%2Fexample.com%2Fmy%20article%3Fa%3D1%26b%3D2."), [
    { text: "출처: " },
    { text: "https://example.com/my article?a=1&b=2", href: "https://example.com/my%20article?a=1&b=2" },
    { text: "." },
  ]);
});

test("handles twice-encoded links and decoded Korean text", () => {
  assert.deepEqual(explanationSegments("%EC%B6%9C%EC%B2%98%3A%20https%253A%252F%252Fexample.org%252Fguide"), [
    { text: "출처: " },
    { text: "https://example.org/guide", href: "https://example.org/guide" },
  ]);
});

test("supports normal URLs, balanced parentheses, punctuation and markdown source labels", () => {
  assert.deepEqual(explanationSegments("See [Wikipedia](https://en.wikipedia.org/wiki/A_(B)), or www.example.org/docs!"), [
    { text: "See " },
    { text: "Wikipedia", href: "https://en.wikipedia.org/wiki/A_(B)" },
    { text: ", or " },
    { text: "www.example.org/docs", href: "https://www.example.org/docs" },
    { text: "!" },
  ]);
});

test("malformed escape and ordinary percent text never crash", () => {
  assert.equal(readableExplanationText("100% %E0%A4%A broken"), "100% %E0%A4%A broken");
  assert.deepEqual(explanationSegments("Just an explanation, 100% true."), [{ text: "Just an explanation, 100% true." }]);
});

test("never turns non-HTTP schemes or credentialed URLs into links", () => {
  assert.deepEqual(explanationSegments("javascript%3Aalert(1) https://user:pass@example.org/hidden"), [
    { text: "javascript:alert(1) https://user:pass@example.org/hidden" },
  ]);
});
