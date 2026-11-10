import assert from "node:assert/strict";
import { test } from "node:test";
import {
  displayText,
  evaluateExpression,
  formatResult,
  initialState,
  press,
} from "../public/calculator.js";

function apply(keys) {
  return keys.reduce((state, key) => press(state, key), initialState());
}

function shown(keys) {
  return displayText(apply(keys));
}

test("starts at zero", () => {
  assert.equal(displayText(initialState()), "0");
});

test("press does not mutate the previous state", () => {
  const state = initialState();
  const next = press(state, "1");
  assert.equal(state.expression, "0");
  assert.equal(next.expression, "1");
});

test("builds integers and ignores a leading zero", () => {
  assert.equal(shown(["1", "2", "3"]), "123");
  assert.equal(shown(["0", "0", "5"]), "5");
});

test("accepts one decimal point in the current number", () => {
  assert.equal(shown(["0", ".", "5"]), "0.5");
  assert.equal(shown(["1", "2", ".", "3", "."]), "12.3");
  assert.equal(shown(["+", "."]), "0+0.");
});

test("replaces operators and allows a unary minus", () => {
  assert.equal(shown(["1", "+", "×"]), "1×");
  assert.equal(shown(["1", "×", "-"]), "1×-");
  assert.equal(shown(["1", "×", "-", "+"]), "1+");
  assert.equal(shown(["-", "8"]), "-8");
  assert.equal(shown(["(", "-", "3", ")"]), "(-3)");
});

test("evaluates with precedence and parentheses", () => {
  assert.equal(shown(["1", "+", "2", "×", "3", "="]), "7");
  assert.equal(shown(["(", "1", "+", "2", ")", "×", "3", "="]), "9");
  assert.equal(shown(["8", "÷", "2", "="]), "4");
  assert.equal(shown(["-", "3", "+", "5", "="]), "2");
});

test("rounds binary floating point for display", () => {
  assert.equal(shown(["0", ".", "1", "+", "0", ".", "2", "="]), "0.3");
  assert.equal(formatResult(1 / 3), "0.333333333333");
});

test("groups digits only after evaluation", () => {
  assert.equal(shown(["1", "0", "0", "0"]), "1000");
  assert.equal(shown(["1", "0", "0", "0", "="]), "1,000");
});

test("continues from the result or starts a new entry", () => {
  assert.equal(shown(["1", "+", "2", "=", "+", "4", "="]), "7");
  assert.equal(shown(["1", "+", "2", "=", "9"]), "9");
});

test("DEL removes the last character and AC clears", () => {
  assert.equal(shown(["1", "2", "DEL"]), "1");
  assert.equal(shown(["1", "2", "DEL", "DEL"]), "0");
  assert.equal(shown(["9", "9", "AC"]), "0");
  assert.equal(shown(["6", "×", "7", "=", "DEL"]), "0");
});

test("shows Error for divide by zero and incomplete input", () => {
  assert.equal(shown(["8", "÷", "0", "="]), "Error");
  assert.equal(shown(["(", "1", "+", "2", "="]), "Error");
  assert.equal(shown(["5", "+", "="]), "Error");
  assert.equal(shown(["8", "÷", "0", "=", "AC"]), "0");
  assert.equal(shown(["8", "÷", "0", "=", "4"]), "4");
});

test("evaluateExpression parses the same operations", () => {
  assert.equal(evaluateExpression("(1+2)×3"), 9);
  assert.equal(evaluateExpression("5×-2"), -10);
  assert.throws(() => evaluateExpression("1÷0"));
  assert.throws(() => evaluateExpression("()"));
});
