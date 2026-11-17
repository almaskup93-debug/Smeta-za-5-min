"use strict";

const positions = document.querySelector("#positions");
const template = document.querySelector("#position-template");
const totalOutput = document.querySelector("#total");
const discountRate = document.querySelector("#discount-rate");
const vatRate = document.querySelector("#vat-rate");
const currency = document.querySelector("#currency");
const moneyFormatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
let nextRowId = 0;
const draftKey = "estimate-five-minutes-draft-v1";
const draftFields = '.details-grid input, #discount-rate, #vat-rate, #currency, #comment';
let restoringDraft = true;
let copyTimer;

function formatMoney(value) {
  const safeValue = Number.isFinite(value) ? value : 0;
  return `${moneyFormatter.format(safeValue).replace(/[\u00a0\u202f]/g, " ")} ${currency.value}`;
}

function roundAmount(value) {
  return Number.isFinite(value) ? Math.round(value) || 0 : 0;
}

function showAmount(outputId, value, rowId) {
  document.querySelector(outputId).textContent = formatMoney(value);
  if (rowId) document.querySelector(rowId).hidden = value === 0;
}

function parseNumber(value) {
  // Accept decimal commas and prices pasted with spaces between thousands.
  const normalized = value.trim().replace(/[\s\u00a0\u202f]/g, "").replace(",", ".");
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return 0;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function recalculate() {
  let total = 0;
  for (const row of positions.rows) {
    const quantity = parseNumber(row.querySelector(".item-quantity").value);
    const price = parseNumber(row.querySelector(".item-price").value);
    const product = quantity * price;
    const amount = roundAmount(product);
    row.querySelector(".item-amount").textContent = formatMoney(amount);
    const priceField = row.querySelector(".item-price");
    const priceLabel = `Цена, ${currency.value}`;
    priceField.previousElementSibling.textContent = priceLabel;
    priceField.closest("td").dataset.label = priceLabel;
    total += amount;
  }
  const subtotal = roundAmount(total);
  const discount = roundAmount(subtotal * (parseNumber(discountRate.value) / 100));
  const discounted = roundAmount(subtotal - discount);
  const vat = roundAmount(discounted * (parseNumber(vatRate.value) / 100));
  showAmount("#subtotal", subtotal);
  showAmount("#discount-amount", discount, "#discount-row");
  showAmount("#discounted-amount", discounted, "#discounted-row");
  showAmount("#vat-amount", vat, "#vat-row");
  totalOutput.textContent = formatMoney(roundAmount(discounted + vat));
  for (const symbol of document.querySelectorAll("[data-currency]")) {
    symbol.textContent = currency.value;
  }
}

function addPosition(focus = true) {
  const row = template.content.firstElementChild.cloneNode(true);
  const rowId = ++nextRowId;
  for (const field of row.querySelectorAll("input, select")) {
    field.id = `${field.className}-${rowId}`;
    field.previousElementSibling.htmlFor = field.id;
  }
  positions.append(row);
  recalculate();
  saveDraft();
  if (focus) row.querySelector(".item-name").focus();
  return row;
}

document.querySelector("#add-position").addEventListener("click", () => addPosition());
discountRate.addEventListener("input", recalculate);
vatRate.addEventListener("input", recalculate);
currency.addEventListener("change", recalculate);
positions.addEventListener("input", recalculate);
positions.addEventListener("click", (event) => {
  const button = event.target.closest(".remove-button");
  if (!button) return;
  const row = button.closest("tr");
  const adjacent = row.nextElementSibling || row.previousElementSibling;
  row.remove();
  recalculate();
  saveDraft();
  if (adjacent) adjacent.querySelector(".item-name").focus();
  else document.querySelector("#add-position").focus();
});
positions.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.isComposing || event.repeat) return;
  // Keep Enter available for the unit selector and native button activation.
  if (!event.target.matches("input")) return;
  if (event.target.closest("tr") === positions.lastElementChild) {
    event.preventDefault();
    addPosition();
  }
});

const today = new Date();
document.querySelector("#estimate-date").value = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, "0"),
  String(today.getDate()).padStart(2, "0"),
].join("-");

addPosition(false);
restoreDraft();
restoringDraft = false;

function saveDraft() {
  if (restoringDraft) return;
  const fields = {};
  for (const field of document.querySelectorAll(draftFields)) {
    fields[field.name || field.id] = field.value;
  }
  const items = Array.from(positions.rows, (row) => ({
    name: row.querySelector(".item-name").value,
    quantity: row.querySelector(".item-quantity").value,
    unit: row.querySelector(".item-unit").value,
    price: row.querySelector(".item-price").value,
  }));
  try {
    localStorage.setItem(draftKey, JSON.stringify({ fields, items }));
    document.querySelector("#draft-status").textContent = "";
  } catch {
    document.querySelector("#draft-status").textContent = "Браузер не разрешил сохранить черновик. Данные останутся только до закрытия или обновления страницы.";
  }
}

function restoreDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(draftKey));
    if (!saved) return;
    if (!saved.fields || !Array.isArray(saved.items) || !saved.items.every(item =>
      item && ["name", "quantity", "unit", "price"].every(key => typeof item[key] === "string")
    )) throw new Error("Invalid draft");
    for (const field of document.querySelectorAll(draftFields)) {
      const value = saved.fields[field.name || field.id];
      if (typeof value !== "string") continue;
      if (field === currency && !["₸", "₽", "$", "€"].includes(value)) continue;
      field.value = value;
    }
    positions.replaceChildren();
    for (const item of saved.items) {
      const row = addPosition(false);
      row.querySelector(".item-name").value = item.name;
      row.querySelector(".item-quantity").value = item.quantity;
      row.querySelector(".item-unit").value = ["шт", "час", "услуга"].includes(item.unit) ? item.unit : "шт";
      row.querySelector(".item-price").value = item.price;
    }
    recalculate();
  } catch {
    document.querySelector("#draft-status").textContent = "Не удалось восстановить черновик. Можно заполнить новую смету.";
  }
}

document.querySelector("main").addEventListener("input", (event) => {
  if (event.target.matches("input, select, #comment")) saveDraft();
});
document.querySelector("main").addEventListener("change", (event) => {
  if (event.target.matches("input, select, #comment")) saveDraft();
});

function resetCopyFeedback() {
  clearTimeout(copyTimer);
  document.querySelector("#copy-status").textContent = "";
  document.querySelector("#manual-copy").hidden = true;
  document.querySelector("#share-text").value = "";
}

document.querySelector("#new-estimate").addEventListener("click", () => {
  if (!window.confirm("Создать новую смету? Текущий черновик будет очищен.")) return;
  const numberField = document.querySelector('[name="estimate-number"]');
  const oldNumber = numberField.value.trim();
  const nextNumber = /\d/.test(oldNumber)
    ? oldNumber.replace(/\d+(?!.*\d)/, digits => String(BigInt(digits) + 1n).padStart(digits.length, "0"))
    : "1";
  restoringDraft = true;
  for (const field of document.querySelectorAll(draftFields)) field.value = "";
  numberField.value = nextNumber;
  const now = new Date();
  document.querySelector("#estimate-date").value = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
  discountRate.value = "0";
  vatRate.value = "0";
  currency.value = "₸";
  positions.replaceChildren();
  resetCopyFeedback();
  addPosition();
  restoringDraft = false;
  saveDraft();
});

function buildShareText() {
  preparePrint();
  const lines = [document.querySelector("#print-title").textContent];
  for (const [selector, label] of [['[name="sender"]', "От кого"], ['[name="recipient"]', "Для кого"]]) {
    const value = document.querySelector(selector).value.trim();
    if (value) lines.push(`${label}: ${value}`);
  }
  lines.push("");
  for (const row of positions.rows) {
    const name = row.querySelector(".item-name").value.trim() || "Без наименования";
    const quantity = parseNumber(row.querySelector(".item-quantity").value);
    const unit = row.querySelector(".item-unit").value;
    const price = parseNumber(row.querySelector(".item-price").value);
    const amount = row.querySelector(".item-amount").textContent;
    lines.push(`• ${name} — ${String(quantity).replace(".", ",")} ${unit} × ${formatMoney(price)} = ${amount}`);
  }
  lines.push("", `Сумма: ${document.querySelector("#subtotal").textContent}`);
  if (!document.querySelector("#discount-row").hidden) {
    lines.push(`Скидка (${parseNumber(discountRate.value)} %): ${document.querySelector("#discount-amount").textContent}`);
    lines.push(`Сумма со скидкой: ${document.querySelector("#discounted-amount").textContent}`);
  }
  if (!document.querySelector("#vat-row").hidden) {
    lines.push(`НДС (${parseNumber(vatRate.value)} %): ${document.querySelector("#vat-amount").textContent}`);
  }
  lines.push(`Итого к оплате: ${totalOutput.textContent}`);
  const comment = document.querySelector("#comment").value.trim();
  if (comment) lines.push("", `Комментарий: ${comment}`);
  return lines.join("\n");
}

document.querySelector("#copy-whatsapp").addEventListener("click", async () => {
  resetCopyFeedback();
  const text = buildShareText();
  try {
    await navigator.clipboard.writeText(text);
    document.querySelector("#copy-status").textContent = "Скопировано ✓";
    copyTimer = setTimeout(() => { document.querySelector("#copy-status").textContent = ""; }, 2000);
  } catch {
    document.querySelector("#manual-copy").hidden = false;
    const field = document.querySelector("#share-text");
    field.value = text;
    field.focus();
    field.select();
  }
});

function preparePrint() {
  recalculate();
  const number = document.querySelector('[name="estimate-number"]').value.trim() || "—";
  const date = document.querySelector("#estimate-date").value;
  const formattedDate = date ? date.split("-").reverse().join(".") : "—";
  document.querySelector("#print-title").textContent = `Смета № ${number} от ${formattedDate}`;

  // Plain text mirrors wrap long values and print the full comment without clipping.
  for (const field of document.querySelectorAll(".details-grid input, #positions input, #positions select, #comment")) {
    let value = field.nextElementSibling;
    if (!value || !value.classList.contains("print-value")) {
      value = document.createElement("span");
      value.className = "print-value";
      value.setAttribute("aria-hidden", "true");
      field.insertAdjacentElement("afterend", value);
    }
    value.textContent = field.classList.contains("item-price")
      ? formatMoney(parseNumber(field.value))
      : field.value;
  }
}

window.addEventListener("beforeprint", preparePrint);
document.querySelector("#save-pdf").addEventListener("click", () => {
  preparePrint();
  window.print();
});
