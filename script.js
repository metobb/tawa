/*
 * TAWA FRONTEND
 * Replace API_URL with the deployed Google Apps Script Web App URL.
 */
const API_URL = "https://script.google.com/macros/s/AKfycbwrBxksOzfmPIj8KADTw4i-8RowJEC5o9sWjEmvPgUnD7Oj-DylIhV8ZwfhXAW4UmC4/exec";
const PRICE_PER_MENU = 8;

const homePage = document.getElementById("homePage");
const orderPage = document.getElementById("orderPage");
const calendar = document.getElementById("calendar");
const menusContainer = document.getElementById("menusContainer");
const selectedDateTitle = document.getElementById("selectedDateTitle");
const menuLoading = document.getElementById("menuLoading");
const orderForm = document.getElementById("orderForm");
const totalPrice = document.getElementById("totalPrice");
const orderButton = document.getElementById("orderButton");
const deliveryToggle = document.getElementById("deliveryToggle");
const deliveryFields = document.getElementById("deliveryFields");
const confirmationModal = document.getElementById("confirmationModal");
const errorModal = document.getElementById("errorModal");
const errorMessage = document.getElementById("errorMessage");

let selectedMenuDate = "";
let currentMenus = [];

document.addEventListener("DOMContentLoaded", () => {
  renderCalendar();
  bindHomeButtons();
  orderForm.addEventListener("submit", submitOrder);
  deliveryToggle.addEventListener("click", toggleDeliveryDetails);
});

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function displayDate(date) {
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
}

function renderCalendar() {
  calendar.innerHTML = "";

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  weekdays.forEach(day => {
    const el = document.createElement("div");
    el.className = "calendar-weekday";
    el.textContent = day;
    calendar.appendChild(el);
  });

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const mondayOffset = (firstDay.getDay() + 6) % 7;

  for (let i = 0; i < mondayOffset; i++) {
    const empty = document.createElement("div");
    empty.className = "calendar-day empty";
    calendar.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const offset = Math.round((date - new Date(year, month, today.getDate())) / 86400000);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day";
    button.textContent = day;

    if (offset === 0) {
      button.classList.add("today");
      button.disabled = true;
    } else if (offset === 1 || offset === 2) {
      button.classList.add("active");
      button.disabled = false;
      button.addEventListener("click", () => openOrderPage(displayDate(date)));
    } else {
      button.disabled = true;
    }

    calendar.appendChild(button);
  }
}

async function openOrderPage(dateString) {
  selectedMenuDate = dateString;
  selectedDateTitle.textContent = `Menu for ${dateString}`;
  homePage.classList.add("hidden");
  orderPage.classList.remove("hidden");
  menusContainer.innerHTML = "";
  menuLoading.textContent = "Loading menus…";
  currentMenus = [];
  updateTotal();

  try {
    const url = `${API_URL}?action=menus&date=${encodeURIComponent(dateString)}`;
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) throw new Error(`Menu request failed (${response.status})`);

    const data = await response.json();
    if (!data.ok) throw new Error(data.error || "Could not load menus.");

    currentMenus = data.menus || [];

    if (currentMenus.length !== 2) {
      menuLoading.textContent = currentMenus.length
        ? `Expected 2 menus, but ${currentMenus.length} menu(s) were found.`
        : "No menus are available for this date.";
    } else {
      menuLoading.textContent = "";
    }

    renderMenus();
  } catch (error) {
    console.error(error);
    menuLoading.textContent = "";
    showError("The menus could not be loaded. Please try again.");
  }
}

function renderMenus() {
  menusContainer.innerHTML = "";

  currentMenus.forEach((menu, index) => {
    const card = document.createElement("article");
    card.className = "menu-card";

    const title = document.createElement("h2");
    title.className = "menu-title";
    title.textContent = menu.menu;
    card.appendChild(title);

    const mealsGrid = document.createElement("div");
    mealsGrid.className = "meals-grid";

    (menu.meals || []).forEach(meal => {
      const mealBox = document.createElement("div");
      mealBox.className = "meal";

      const img = document.createElement("img");
      img.src = meal.picture;
      img.alt = meal.meal;
      img.loading = "lazy";
      img.onerror = () => {
        img.style.display = "none";
      };

      const name = document.createElement("p");
      name.className = "meal-name";
      name.textContent = meal.meal;

      mealBox.appendChild(img);
      mealBox.appendChild(name);
      mealsGrid.appendChild(mealBox);
    });

    card.appendChild(mealsGrid);

    const controls = document.createElement("div");
    controls.className = "menu-controls";

    const price = document.createElement("div");
    price.className = "menu-price";
    price.textContent = `${PRICE_PER_MENU.toFixed(2)} €`;

    const select = document.createElement("select");
    select.className = "menu-amount";
    select.dataset.menuIndex = String(index);
    select.setAttribute("aria-label", `Amount for ${menu.menu}`);

    const zero = document.createElement("option");
    zero.value = "0";
    zero.textContent = "—";
    select.appendChild(zero);

    for (let amount = 1; amount <= 10; amount++) {
      const option = document.createElement("option");
      option.value = String(amount);
      option.textContent = String(amount);
      select.appendChild(option);
    }

    select.addEventListener("change", updateTotal);

    controls.appendChild(price);
    controls.appendChild(select);
    card.appendChild(controls);

    menusContainer.appendChild(card);
  });

  updateTotal();
}

function toggleDeliveryDetails() {
  const expanded = deliveryToggle.getAttribute("aria-expanded") === "true";
  deliveryToggle.setAttribute("aria-expanded", String(!expanded));
  deliveryFields.hidden = expanded;
  deliveryToggle.classList.toggle("expanded", !expanded);
}

function getSelectedOrders() {
  return [...document.querySelectorAll(".menu-amount")]
    .map(select => ({
      menu: currentMenus[Number(select.dataset.menuIndex)]?.menu || "",
      amount: Number(select.value) || 0
    }))
    .filter(item => item.amount > 0);
}

function updateTotal() {
  const total = getSelectedOrders()
    .reduce((sum, item) => sum + item.amount * PRICE_PER_MENU, 0);
  totalPrice.textContent = `${total.toFixed(2)} €`;
}

async function submitOrder(event) {
  event.preventDefault();

  const selectedOrders = getSelectedOrders();
  if (selectedOrders.length === 0) {
    showError("Please select at least one menu.");
    return;
  }

  if (!orderForm.checkValidity()) {
    orderForm.reportValidity();
    return;
  }

  const payload = {
    orders: selectedOrders,
    dateOfMenu: selectedMenuDate,
    surname: document.getElementById("surname").value.trim(),
    street: document.getElementById("street").value,
    houseNumber: document.getElementById("houseNumber").value.trim(),
    zipcode: document.getElementById("zipcode").value.trim(),
    email: document.getElementById("email").value.trim(),
    description: document.getElementById("description").value.trim()
  };

  orderButton.disabled = true;
  orderButton.textContent = "Sending…";

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
      },
      body: new URLSearchParams({
        action: "order",
        payload: JSON.stringify(payload)
      })
    });

    if (!response.ok) throw new Error(`Order request failed (${response.status})`);

    const data = await response.json();
    if (!data.ok) throw new Error(data.error || "The order could not be saved.");

    confirmationModal.classList.remove("hidden");
  } catch (error) {
    console.error(error);
    showError("The order could not be completed. Please try again.");
  } finally {
    orderButton.disabled = false;
    orderButton.textContent = "Order";
  }
}

function bindHomeButtons() {
  [
    document.getElementById("homeTopButton"),
    document.getElementById("homeBottomButton"),
    document.getElementById("confirmationHomeButton")
  ].forEach(button => {
    button.addEventListener("click", goHome);
  });

  document.getElementById("errorCloseButton").addEventListener("click", () => {
    errorModal.classList.add("hidden");
  });
}

function goHome() {
  confirmationModal.classList.add("hidden");
  orderPage.classList.add("hidden");
  homePage.classList.remove("hidden");
  orderForm.reset();
  document.getElementById("zipcode").value = "20357";
  deliveryToggle.setAttribute("aria-expanded", "false");
  deliveryFields.hidden = true;
  deliveryToggle.classList.remove("expanded");
  menusContainer.innerHTML = "";
  currentMenus = [];
  selectedMenuDate = "";
  updateTotal();
  renderCalendar();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showError(message) {
  errorMessage.textContent = message;
  errorModal.classList.remove("hidden");
}
