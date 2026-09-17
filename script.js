/*
 * TAWA FRONTEND
 * Replace API_URL with the deployed Google Apps Script Web App URL.
 */
const API_URL = "https://script.google.com/macros/s/AKfycbwrBxksOzfmPIj8KADTw4i-8RowJEC5o9sWjEmvPgUnD7Oj-DylIhV8ZwfhXAW4UmC4/exec";
const PRICE_PER_MENU = 8;

const startPage = document.getElementById("startPage");
const calendarPage = document.getElementById("calendarPage");
const orderPage = document.getElementById("orderPage");
const calendar = document.getElementById("calendar");
const menusContainer = document.getElementById("menusContainer");
const selectedDateTitle = document.getElementById("selectedDateTitle");
const menuLoading = document.getElementById("menuLoading");
const orderContent = document.getElementById("orderContent");
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

// The ordering window is based on the current week:
// today and all previous days are inactive; the next two weekdays are active;
// weekends and all other dates are inactive.
function startOfWeekMonday(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay();
  const mondayOffset = (day + 6) % 7;
  result.setDate(result.getDate() - mondayOffset);
  return result;
}

function dateOnly(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(a, b) {
  return Math.round((dateOnly(b) - dateOnly(a)) / 86400000);
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("dinnerButton").addEventListener("click", showCalendarPage);
  document.getElementById("calendarHomeButton").addEventListener("click", showStartPage);

  bindNavigationButtons();
  orderForm.addEventListener("submit", submitOrder);
  deliveryToggle.addEventListener("click", toggleDeliveryDetails);

  // Calendar is rendered when the calendar page is opened, and also once here
  // so it is ready immediately after navigating to it.
  renderCalendar();
});

function displayDate(date) {
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
}

function showStartPage() {
  confirmationModal.classList.add("hidden");
  errorModal.classList.add("hidden");
  startPage.classList.remove("hidden");
  calendarPage.classList.add("hidden");
  orderPage.classList.add("hidden");
  resetOrderPage();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showCalendarPage() {
  confirmationModal.classList.add("hidden");
  errorModal.classList.add("hidden");
  startPage.classList.add("hidden");
  orderPage.classList.add("hidden");
  calendarPage.classList.remove("hidden");
  renderCalendar();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showOrderPage(dateString) {
  startPage.classList.add("hidden");
  calendarPage.classList.add("hidden");
  orderPage.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
  openOrderPage(dateString);
}

function renderCalendar() {
  calendar.innerHTML = "";

  const today = dateOnly(new Date());
  const year = today.getFullYear();
  const month = today.getMonth();
  const weekStart = startOfWeekMonday(today);

  const weekdays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
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

  // Only the two weekdays immediately after today are active.
  // The remaining days of the current week are red (past/today), while all
  // other dates are gray/inactive. Weekends are always gray/inactive.
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const offsetFromToday = daysBetween(today, date);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const inCurrentWeek = daysBetween(weekStart, date) >= 0 && daysBetween(weekStart, date) <= 6;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day";
    button.textContent = day;
    button.disabled = true;

    if (inCurrentWeek && !isWeekend && offsetFromToday <= 0) {
      button.classList.add("past");
    } else if (inCurrentWeek && !isWeekend && (offsetFromToday === 1 || offsetFromToday === 2)) {
      button.classList.add("active");
      button.disabled = false;
      button.addEventListener("click", () => showOrderPage(displayDate(date)));
    } else if (offsetFromToday === 0) {
      // Today is red, even if it is a weekend.
      button.classList.add("today");
    } else {
      button.classList.add("inactive");
    }
  
    calendar.appendChild(button);
  }
}

async function openOrderPage(dateString) {
  selectedMenuDate = dateString;
  selectedDateTitle.textContent = `Menüs für ${dateString}`;
  menusContainer.innerHTML = "";
  currentMenus = [];
  updateTotal();
  resetDeliveryDetails();

  // During loading, only the loading bar and selected date are visible.
  orderContent.classList.add("hidden");
  menuLoading.classList.remove("hidden");

  try {
    const url = `${API_URL}?action=menus&date=${encodeURIComponent(dateString)}`;
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) throw new Error(`Menu request failed (${response.status})`);

    const data = await response.json();
    if (!data.ok) throw new Error(data.error || "Menüs wurden nicht geladen.");

    currentMenus = data.menus || [];

    if (currentMenus.length !== 2) {
      if (currentMenus.length === 0) {
        throw new Error("Für dieses Datum sind keine Menüs verfügbar.");
      }
      throw new Error(`Es wurden ${currentMenus.length} statt 2 Menüs für dieses Datum gefunden.`);
    }

    renderMenus();
    menuLoading.classList.add("hidden");
    orderContent.classList.remove("hidden");
  } catch (error) {
    console.error(error);
    menuLoading.classList.add("hidden");
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
  deliveryToggle.setAttribute("aria-expanded", String(!expanded));
  deliveryFields.hidden = expanded;
  deliveryToggle.classList.toggle("expanded", !expanded);
}

function resetDeliveryDetails() {
  deliveryToggle.setAttribute("aria-expanded", "false");
  deliveryFields.hidden = true;
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

function bindNavigationButtons() {
  [
    document.getElementById("homeTopButton"),
    document.getElementById("homeBottomButton"),
    document.getElementById("confirmationHomeButton")
  ].forEach(button => {
    button.addEventListener("click", showStartPage);
  });

  [
    document.getElementById("backTopButton"),
    document.getElementById("backBottomButton")
  ].forEach(button => {
    button.addEventListener("click", showCalendarPage);
  });

  document.getElementById("errorCloseButton").addEventListener("click", () => {
    errorModal.classList.add("hidden");
  });
}

function resetOrderPage() {
  orderForm.reset();
  document.getElementById("zipcode").value = "20357";
  resetDeliveryDetails();
  menusContainer.innerHTML = "";
  orderContent.classList.add("hidden");
  menuLoading.classList.add("hidden");
  currentMenus = [];
  selectedMenuDate = "";
  updateTotal();
}

function showError(message) {
  errorMessage.textContent = message;
  errorModal.classList.remove("hidden");
}
