const MAX_LENGTH = 128;
const OPERATORS = new Set(["+", "-", "×", "÷"]);

export function initialState() {
  return { expression: "0", justEvaluated: false, error: null };
}

export function displayText(state) {
  if (state.error) return "Error";
  const expression = state.expression || "0";
  if (state.justEvaluated) return groupDigits(expression);
  return expression;
}

export function press(state, key) {
  if (key === "AC") return initialState();

  let current = state;
  if (current.error) {
    if (key === "DEL") return initialState();
    current = initialState();
  }

  switch (key) {
    case "DEL":
      return deleteLast(current);
    case "=":
      return commit(current);
    case ".":
      return inputDot(current);
    case "(":
      return inputOpenParen(current);
    case ")":
      return inputCloseParen(current);
    case "+":
    case "-":
    case "×":
    case "÷":
    case "x":
    case "X":
    case "*":
    case "/":
      return inputOperator(current, normalizeOperator(key));
    default:
      if (/^[0-9]$/.test(key)) return inputDigit(current, key);
      return current;
  }
}

export function evaluateExpression(input) {
  const source = String(input).replace(/×/g, "*").replace(/÷/g, "/");
  let index = 0;

  function peek() {
    return source[index];
  }

  function parseExpression() {
    let value = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const operator = peek();
      index += 1;
      const right = parseTerm();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  }

  function parseTerm() {
    let value = parseUnary();
    while (peek() === "*" || peek() === "/") {
      const operator = peek();
      index += 1;
      const right = parseUnary();
      if (operator === "/" && right === 0) {
        throw new Error("Division by zero");
      }
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  }

  function parseUnary() {
    if (peek() === "-") {
      index += 1;
      return -parseUnary();
    }
    return parsePrimary();
  }

  function parsePrimary() {
    if (peek() === "(") {
      index += 1;
      const value = parseExpression();
      if (peek() !== ")") throw new Error("Unclosed parenthesis");
      index += 1;
      return value;
    }
    return parseNumber();
  }

  function parseNumber() {
    const start = index;
    if (!isDigit(peek())) throw new Error("Expected number");
    while (isDigit(peek())) index += 1;
    if (peek() === ".") {
      index += 1;
      while (isDigit(peek())) index += 1;
    }
    if (peek() === "e" || peek() === "E") {
      index += 1;
      if (peek() === "+" || peek() === "-") index += 1;
      if (!isDigit(peek())) throw new Error("Expected exponent");
      while (isDigit(peek())) index += 1;
    }
    const lexeme = source.slice(start, index);
    if (!/^\d+(\.\d*)?(e[+-]?\d+)?$/i.test(lexeme)) {
      throw new Error("Invalid number");
    }
    const value = Number(lexeme);
    if (!Number.isFinite(value)) throw new Error("Invalid number");
    return value;
  }

  if (source.length === 0) throw new Error("Empty expression");
  const value = parseExpression();
  if (index !== source.length) throw new Error("Unexpected trailing input");
  if (!Number.isFinite(value)) throw new Error("Non-finite result");
  return value;
}

export function formatResult(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value === 0) return "0";

  const rounded = Number(value.toPrecision(12));
  if (rounded === 0) return "0";

  const absolute = Math.abs(rounded);
  if (absolute >= 1e12 || absolute < 1e-9) {
    return trimExponent(rounded.toExponential(6));
  }

  const sign = rounded < 0 ? "-" : "";
  const [integer, fraction] = Math.abs(rounded).toFixed(12).split(".");
  const trimmed = fraction.replace(/0+$/, "");
  return trimmed ? `${sign}${integer}.${trimmed}` : `${sign}${integer}`;
}

function inputDigit(state, digit) {
  if (state.justEvaluated) {
    return editing(digit === "0" ? "0" : digit);
  }

  const expression = state.expression;
  if (expression === "0") return editing(digit);
  if (expression.endsWith(")")) return state;
  if (isStandaloneZero(expression)) {
    return editing(expression.slice(0, -1) + digit);
  }
  if (expression.length >= MAX_LENGTH) return state;
  return editing(expression + digit);
}

function inputDot(state) {
  if (state.justEvaluated) return editing("0.");

  const expression = state.expression;
  if (expression.endsWith(")")) return state;

  const trailing = trailingNumber(expression);
  if (trailing.includes(".")) return state;
  if (trailing === "") {
    const next = `${expression === "0" ? "" : expression}0.`;
    if (next.length > MAX_LENGTH) return state;
    return editing(next);
  }
  if (expression.length >= MAX_LENGTH) return state;
  return editing(expression + ".");
}

function inputOperator(state, operator) {
  if (state.justEvaluated) {
    const next = state.expression + operator;
    if (next.length > MAX_LENGTH) return state;
    return editing(next);
  }

  let expression = state.expression;
  if (expression.endsWith(".")) expression = expression.slice(0, -1);

  if (expression === "0") {
    return editing(operator === "-" ? "-" : `0${operator}`);
  }
  if (expression === "-") {
    return operator === "-" ? state : editing(`0${operator}`);
  }

  const last = expression.at(-1);
  if (OPERATORS.has(last)) {
    const previous = expression.at(-2);
    const unaryMinus =
      last === "-" &&
      (previous === undefined || OPERATORS.has(previous) || previous === "(");

    if (operator === "-" && !unaryMinus && last !== "-") {
      if (expression.length >= MAX_LENGTH) return state;
      return editing(expression + "-");
    }
    if (unaryMinus && operator === "-") return state;
    if (unaryMinus) {
      const withoutMinus = expression.slice(0, -1);
      const operatorBeforeMinus = withoutMinus.at(-1);
      if (OPERATORS.has(operatorBeforeMinus)) {
        return editing(withoutMinus.slice(0, -1) + operator);
      }
      return editing(withoutMinus + operator);
    }
    return editing(expression.slice(0, -1) + operator);
  }

  if (last === "(") {
    if (operator !== "-") return state;
    if (expression.length >= MAX_LENGTH) return state;
    return editing(expression + "-");
  }

  if (/\d|\)/.test(last)) {
    if (expression.length >= MAX_LENGTH) return state;
    return editing(expression + operator);
  }
  return state;
}

function inputOpenParen(state) {
  if (state.justEvaluated || state.expression === "0") return editing("(");

  const last = state.expression.at(-1);
  if (/\d|\)|\./.test(last)) return state;
  if (state.expression.length >= MAX_LENGTH) return state;
  return editing(state.expression + "(");
}

function inputCloseParen(state) {
  if (state.justEvaluated) return state;

  let expression = state.expression;
  if (expression.endsWith(".")) expression = expression.slice(0, -1);
  if (unclosedParens(expression) <= 0) return state;
  if (!/\d|\)/.test(expression.at(-1))) return state;
  if (expression.length >= MAX_LENGTH) return state;
  return editing(expression + ")");
}

function deleteLast(state) {
  if (state.justEvaluated || state.expression.length <= 1) return initialState();
  return editing(state.expression.slice(0, -1));
}

function commit(state) {
  let expression = state.expression;
  if (expression.endsWith(".")) expression = expression.slice(0, -1);

  try {
    const formatted = formatResult(evaluateExpression(expression));
    if (formatted == null) return errorState(expression);
    return { expression: formatted, justEvaluated: true, error: null };
  } catch {
    return errorState(expression);
  }
}

function editing(expression) {
  return { expression, justEvaluated: false, error: null };
}

function errorState(expression) {
  return { expression, justEvaluated: false, error: "Error" };
}

function normalizeOperator(key) {
  if (key === "x" || key === "X" || key === "*") return "×";
  if (key === "/") return "÷";
  return key;
}

function isStandaloneZero(expression) {
  return /(?:^|[+\-×÷(])0$/.test(expression);
}

function trailingNumber(expression) {
  const match = expression.match(/(\d*\.?\d*)$/);
  return match ? match[1] : "";
}

function unclosedParens(expression) {
  let count = 0;
  for (const character of expression) {
    if (character === "(") count += 1;
    else if (character === ")") count -= 1;
  }
  return count;
}

function groupDigits(expression) {
  if (!/^-?\d+(\.\d+)?$/.test(expression)) return expression;
  const negative = expression.startsWith("-");
  const [integer, fraction] = expression.slice(negative ? 1 : 0).split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const body = fraction === undefined ? grouped : `${grouped}.${fraction}`;
  return `${negative ? "-" : ""}${body}`;
}

function trimExponent(text) {
  return text.replace(/(\.\d*?)0+e/, "$1e").replace(/\.e/, "e");
}

function isDigit(character) {
  return character !== undefined && character >= "0" && character <= "9";
}
