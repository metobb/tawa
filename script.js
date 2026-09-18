/*
 * TAWA FRONTEND
 * Replace API_URL with the deployed Google Apps Script Web App URL.
 */
const API_URL = "https://script.google.com/macros/s/AKfycbwrBxksOzfmPIj8KADTw4i-8RowJEC5o9sWjEmvPgUnD7Oj-DylIhV8ZwfhXAW4UmC4/exec";
const PRICE_PER_MENU = 8;

const startPage = document.getElementById("startPage");
const calendarPage = document.getElementById("calendarPage");
const menuPage = document.getElementById("menuPage");
const calendar = document.getElementById("calendar");
const menusContainer = document.getElementById("menusContainer");
const selectedDateTitle = document.getElementById("selectedDateTitle");
const menuLoadingBar = document.getElementById("menuLoadingBar");
const orderContent = document.getElementById("orderContent");
const orderForm = document.getElementById("orderForm");
const totalPrice = document.getElementById("totalPrice");
const orderSummary = document.getElementById("orderSummary");
const orderButton = document.getElementById("orderButton");
const deliveryToggle = document.getElementById("deliveryToggle");
const deliveryFields = document.getElementById("deliveryFields");
const confirmationModal = document.getElementById("confirmationModal");
const errorModal = document.getElementById("errorModal");
const errorMessage = document.getElementById("errorMessage");
const leaveModal = document.getElementById("leaveModal");
const leaveYesButton = document.getElementById("leaveYesButton");
const leaveNoButton = document.getElementById("leaveNoButton");

let selectedMenuDate = "";
let currentMenus = [];
let pendingLeavePage = "";

function dateOnly(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function displayDate(date) {
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
}

function mondayOfWeek(date) {
  const d = dateOnly(date);
  const day = d.getDay(); // Sun=0 ... Sat=6
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
}

function getCalendarState(date, today) {
  const d = dateOnly(date);
  const t = dateOnly(today);
  const dayOfWeek = d.getDay();

  // Saturday and Sunday are always unavailable.
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return "gray";
  }

  // On Friday, the complete following Monday-Friday is available.
  if (t.getDay() === 5) {
    const nextMonday = new Date(t);
    nextMonday.setDate(t.getDate() + 3);

    const nextFriday = new Date(nextMonday);
    nextFriday.setDate(nextMonday.getDate() + 4);

    if (d >= nextMonday && d <= nextFriday) {
      return "green";
    }
  }

  // During the current week, future weekdays are available.
  // Today and previous weekdays are red/inactive.
  const currentMonday = mondayOfWeek(t);
  const dateMonday = mondayOfWeek(d);

  if (dateMonday.getTime() === currentMonday.getTime()) {
    return d > t ? "green" : "red";
  }

  return "gray";
}

function showPage(pageId) {
  ["startPage", "calendarPage", "menuPage"].forEach(id => {
    const page = document.getElementById(id);
    if (!page) return;

    const active = id === pageId;
    page.hidden = !active;
    page.classList.toggle("hidden", !active);
    page.setAttribute("aria-hidden", active ? "false" : "true");
  });

  window.scrollTo(0, 0);
}

function showStartPage() {
  confirmationModal.classList.add("hidden");
  errorModal.classList.add("hidden");
  leaveModal.classList.add("hidden");
  resetOrderPage();
  showPage("startPage");
}

function showCalendarPage() {
  confirmationModal.classList.add("hidden");
  errorModal.classList.add("hidden");
  leaveModal.classList.add("hidden");
  showPage("calendarPage");
  renderCalendar();
}

function showOrderPage(dateString) {
  confirmationModal.classList.add("hidden");
  errorModal.classList.add("hidden");
  leaveModal.classList.add("hidden");

  selectedMenuDate = dateString;
  selectedDateTitle.textContent = `Menüs für ${dateString}`;

  // Show the menu page immediately. While the request is running,
  // only navigation, selected date and the loading bar are visible.
  showPage("menuPage");
  prepareMenuLoadingState();

  loadMenusForDate(dateString);
}

function renderCalendar() {
  calendar.innerHTML = "";

  const today = dateOnly(new Date());
  const year = today.getFullYear();
  const month = today.getMonth();

  ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].forEach(day => {
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
    const state = getCalendarState(date, today);
    const dateString = displayDate(date);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day";
    button.textContent = day;
    button.dataset.date = dateString;
    button.dataset.dateIso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    button.disabled = state !== "green";
    button.setAttribute("aria-disabled", state === "green" ? "false" : "true");

    if (state === "green") {
      button.classList.add("active-green");
      button.addEventListener("click", () => showOrderPage(dateString));
    } else if (state === "red") {
      button.classList.add("inactive-red");
    } else {
      button.classList.add("inactive-gray");
    }

    calendar.appendChild(button);
  }
}

function prepareMenuLoadingState() {
  menusContainer.innerHTML = "";
  currentMenus = [];
  updateTotal();
  resetDeliveryDetails();

  orderContent.classList.add("hidden");
  menuLoadingBar.hidden = false;
}

async function loadMenusForDate(dateString) {
  try {
    const url = `${API_URL}?action=menus&date=${encodeURIComponent(dateString)}`;
    const response = await fetch(url, {
      method: "GET",
      mode: "cors",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Menu request failed (${response.status})`);
    }

    const data = await response.json();
    if (!data.ok) {
      throw new Error(data.error || "Menüs wurden nicht geladen.");
    }

    currentMenus = Array.isArray(data.menus) ? data.menus : [];

    if (currentMenus.length !== 2) {
      if (currentMenus.length === 0) {
        throw new Error("Für dieses Datum sind keine Menüs verfügbar.");
      }
      throw new Error(`Es wurden ${currentMenus.length} statt 2 Menüs für dieses Datum gefunden.`);
    }

    renderMenus();
    resetDeliveryDetails();

    // Only after the menu data has arrived do the menu/order sections become visible.
    menuLoadingBar.hidden = true;
    orderContent.classList.remove("hidden");
  } catch (error) {
    console.error("Menu loading failed:", error);
    menuLoadingBar.hidden = true;
    orderContent.classList.add("hidden");
    showError("Die Menüs konnten nicht geladen werden. Bitte versuchen Sie es erneut.");
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
    select.setAttribute("aria-label", `Anzahl für ${menu.menu}`);

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
  const nextExpanded = !expanded;

  deliveryToggle.setAttribute("aria-expanded", String(nextExpanded));
  deliveryFields.hidden = !nextExpanded;
  orderButton.hidden = !nextExpanded;
  orderSummary.hidden = !nextExpanded;
  deliveryToggle.classList.toggle("expanded", nextExpanded);
}

function resetDeliveryDetails() {
  deliveryToggle.setAttribute("aria-expanded", "false");
  deliveryFields.hidden = true;
  orderButton.hidden = true;
  orderSummary.hidden = true;
  deliveryToggle.classList.remove("expanded");
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
    showError("Bitte wählen Sie mindestens ein Menü aus.");
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
  orderButton.textContent = "Wird gesendet…";

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
    if (!data.ok) throw new Error(data.error || "Die Bestellung konnte nicht gespeichert werden.");

    confirmationModal.classList.remove("hidden");
  } catch (error) {
    console.error(error);
    showError("Die Bestellung konnte nicht abgeschlossen werden. Bitte versuchen Sie es erneut.");
  } finally {
    orderButton.disabled = false;
    orderButton.textContent = "Bestellen";
  }
}

function hasMenuSelections() {
  return getSelectedOrders().length > 0;
}

function requestLeaveMenuPage(targetPage) {
  if (!hasMenuSelections()) {
    if (targetPage === "startPage") {
      showStartPage();
    } else {
      resetOrderPage();
      showCalendarPage();
    }
    return;
  }

  pendingLeavePage = targetPage;
  leaveModal.classList.remove("hidden");
}

function confirmLeaveMenuPage() {
  const targetPage = pendingLeavePage;
  pendingLeavePage = "";
  leaveModal.classList.add("hidden");

  // Leaving the menu page deliberately removes the current selections/details.
  resetOrderPage();

  if (targetPage === "startPage") {
    showStartPage();
  } else if (targetPage === "calendarPage") {
    showCalendarPage();
  }
}

function cancelLeaveMenuPage() {
  pendingLeavePage = "";
  leaveModal.classList.add("hidden");
}

function bindNavigationButtons() {
  [
    document.getElementById("homeTopButton"),
    document.getElementById("homeBottomButton")
  ].forEach(button => {
    if (button) button.addEventListener("click", () => requestLeaveMenuPage("startPage"));
  });

  [
    document.getElementById("backTopButton"),
    document.getElementById("backBottomButton")
  ].forEach(button => {
    if (button) button.addEventListener("click", () => requestLeaveMenuPage("calendarPage"));
  });

  const confirmationHomeButton = document.getElementById("confirmationHomeButton");
  if (confirmationHomeButton) {
    confirmationHomeButton.addEventListener("click", showStartPage);
  }

  if (leaveYesButton) leaveYesButton.addEventListener("click", confirmLeaveMenuPage);
  if (leaveNoButton) leaveNoButton.addEventListener("click", cancelLeaveMenuPage);

  document.getElementById("errorCloseButton").addEventListener("click", () => {
    errorModal.classList.add("hidden");
  });
}

function resetOrderPage() {
  orderForm.reset();
  document.getElementById("zipcode").value = "20357";
  resetDeliveryDetails();
  menusContainer.innerHTML = "";
  currentMenus = [];
  selectedMenuDate = "";
  menuLoadingBar.hidden = true;
  orderContent.classList.add("hidden");
  updateTotal();
}

function showError(message) {
  errorMessage.textContent = message;
  errorModal.classList.remove("hidden");
}

document.addEventListener("DOMContentLoaded", () => {
  const dinnerButton = document.getElementById("dinnerButton");
  const calendarHomeButton = document.getElementById("calendarHomeButton");

  if (dinnerButton) dinnerButton.addEventListener("click", showCalendarPage);
  if (calendarHomeButton) calendarHomeButton.addEventListener("click", showStartPage);
  if (deliveryToggle) deliveryToggle.addEventListener("click", toggleDeliveryDetails);

  bindNavigationButtons();
  orderForm.addEventListener("submit", submitOrder);

  // Start page is the initial page.
  showStartPage();
});
