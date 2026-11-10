import { displayText, initialState, press } from "./calculator.js";

const display = document.querySelector("#display");
const keypad = document.querySelector(".keypad");

let state = initialState();

function render() {
  display.textContent = displayText(state);
  display.classList.toggle("is-error", state.error != null);
  display.scrollLeft = display.scrollWidth;
}

keypad.addEventListener("click", (event) => {
  const button = event.target.closest("[data-key]");
  if (!button) return;
  state = press(state, button.dataset.key);
  render();
});

document.addEventListener("keydown", (event) => {
  const key = event.key;
  if (key === "Enter") {
    event.preventDefault();
    state = press(state, "=");
  } else if (key === "Backspace") {
    event.preventDefault();
    state = press(state, "DEL");
  } else if (key === "Escape") {
    state = press(state, "AC");
  } else if (key === "Delete") {
    state = press(state, "AC");
  } else if (/^[0-9.+\-*/()=]$/.test(key) || key === "x" || key === "X") {
    state = press(state, key === "=" ? "=" : key);
  } else {
    return;
  }
  render();
});

render();
