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
  showPage("calendarPage");
  if (typeof renderCalendar === "function") renderCalendar();
  if (typeof applyCalendarAvailability === "function") applyCalendarAvailability();
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
  /* openOrderPage__v11 */
  setMenuLoading(true);
  collapseDeliveryDetails();
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
    setMenuLoading(false);
    collapseDeliveryDetails();
    initDeliveryToggle();
    menuLoading.classList.add("hidden");
    orderContent.classList.remove("hidden");
  } catch (error) {
    console.error(error);
    menuLoading.classList.add("hidden");
    orderContent.classList.add("hidden");
    setMenuLoading(false);
    showError("Die Menüs konnten nicht geladen werden. Bitte versuchen Sie es erneut.");
  }

  applyCalendarAvailability();
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



document.addEventListener("DOMContentLoaded", function () {
  const abendessenButton = document.getElementById("abendessenButton");
  if (!abendessenButton) return;

  abendessenButton.addEventListener("click", function (event) {
    event.preventDefault();

    // Prefer the existing page-navigation function if the current app provides one.
    if (typeof showCalendarPage === "function") {
      showCalendarPage();
      return;
    }
    if (typeof openCalendarPage === "function") {
      openCalendarPage();
      return;
    }
    if (typeof goToCalendarPage === "function") {
      goToCalendarPage();
      return;
    }

    const startPage =
      document.getElementById("startPage") ||
      document.querySelector(".start-page, #homePage, .home-page");

    const calendarPage =
      document.getElementById("calendarPage") ||
      document.querySelector(".calendar-page");

    if (startPage && calendarPage) {
      startPage.classList.add("hidden");
      startPage.setAttribute("aria-hidden", "true");
      calendarPage.classList.remove("hidden");
      calendarPage.removeAttribute("aria-hidden");
      calendarPage.scrollIntoView({ behavior: "auto", block: "start" });
    }
  });
});


/* =========================================================
   Page navigation
   Technical page IDs are English:
   startPage -> calendarPage -> menuPage
   ========================================================= */

function showPage(pageId) {
  ["startPage", "calendarPage", "menuPage"].forEach(function (id) {
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
  showPage("startPage");
}

function showCalendarPage() {
  showPage("calendarPage");
  // Calendar rendering is independent of page visibility.
  if (typeof renderCalendar === "function") {
    renderCalendar();
  }
}

function showMenuPage() {
  showPage("menuPage");
}

document.addEventListener("DOMContentLoaded", function () {
  const dinnerButton = document.getElementById("abendessenButton");
  if (dinnerButton) {
    dinnerButton.addEventListener("click", function (event) {
      event.preventDefault();
      showCalendarPage();
    });
  }

  // Explicitly connect all Startseite buttons to the new start page.
  document.querySelectorAll('[data-page="startPage"], #calendarHomeButton, #menuHomeButton, #menuBottomHomeButton').forEach(function (button) {
    button.addEventListener("click", function (event) {
      event.preventDefault();
      showStartPage();
    });
  });

  // Explicitly connect all Zurück buttons to the calendar page.
  document.querySelectorAll('[data-page="calendarPage"], #calendarBackButton, #menuBackButton, #menuBottomBackButton').forEach(function (button) {
    button.addEventListener("click", function (event) {
      event.preventDefault();
      showCalendarPage();
    });
  });

  // New landing page is the initial page.
  showStartPage();
});


/* ===== V11 calendar and menu loading ===== */

function mondayOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // Sun=0 ... Sat=6
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}

function getCalendarState(date, today) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // Weekend is always inactive/gray.
  if (d.getDay() === 0 || d.getDay() === 6) return "gray";

  const currentMonday = mondayOfWeek(t);
  const dateMonday = mondayOfWeek(d);
  const weekDifference = Math.round(
    (dateMonday.getTime() - currentMonday.getTime()) /
    (7 * 24 * 60 * 60 * 1000)
  );

  // Friday: ALL Monday-Friday dates in the immediately following week
  // are active. This is the special rule requested for ordering.
  if (t.getDay() === 5 && weekDifference === 1) {
    return "green";
  }

  // During the current week, only future weekdays are active.
  if (weekDifference === 0) {
    return d > t ? "green" : "red";
  }

  // Everything else is inactive/gray.
  return "gray";
}

function styleCalendarCell(cell, date) {
  const state = getCalendarState(date, new Date());

  cell.classList.remove(
    "active-green", "inactive-red", "inactive-gray",
    "active", "available", "inactive", "past", "today"
  );

  if (state === "green") {
    cell.classList.add("active-green");
    cell.disabled = false;
    cell.setAttribute("aria-disabled", "false");
  } else if (state === "red") {
    cell.classList.add("inactive-red");
    cell.disabled = true;
    cell.setAttribute("aria-disabled", "true");
  } else {
    cell.classList.add("inactive-gray");
    cell.disabled = true;
    cell.setAttribute("aria-disabled", "true");
  }

  return state;
}

function applyCalendarAvailability() {
  const calendar = document.getElementById("calendar");
  if (!calendar) return;

  // Support data-date values when available.
  calendar.querySelectorAll("[data-date], [data-date-string]").forEach(function(cell) {
    const raw = cell.dataset.date || cell.dataset.dateString;
    let date = null;

    if (/^\d{2}\.\d{2}\.\d{4}$/.test(raw)) {
      const p = raw.split(".");
      date = new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const p = raw.split("-");
      date = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    }

    if (date) styleCalendarCell(cell, date);
  });
}
function setMenuLoading(on){
  const bar=document.getElementById("menuLoadingBar");
  if(bar) bar.hidden=!on;
  const page=document.getElementById("menuPage");
  if(!page) return;
  page.querySelectorAll(".menu-card,.menus-container,#menusContainer,#menuContainer,.delivery-section,#deliverySection,.order-details,.order-summary,#orderButton,.order-button,.total-section,.order-total")
    .forEach(el=>el.classList.toggle("menu-content-loading-hidden",on));
}
function collapseDeliveryDetails(){
  const d=document.getElementById("deliveryDetails")||document.querySelector(".delivery-fields");
  const t=document.getElementById("deliveryToggle");
  if(d) d.hidden=true;
  if(t) t.setAttribute("aria-expanded","false");
}
function initDeliveryToggle(){
  const d=document.getElementById("deliveryDetails")||document.querySelector(".delivery-fields");
  const t=document.getElementById("deliveryToggle");
  if(!d||!t||t.dataset.bound==="1") return;
  t.dataset.bound="1";
  t.addEventListener("click",()=>{
    const open=d.hidden;
    d.hidden=!open;
    t.setAttribute("aria-expanded",String(open));
  });
}

document.addEventListener("DOMContentLoaded",function(){
  collapseDeliveryDetails();
  initDeliveryToggle();
  if(typeof renderCalendar==="function"){ renderCalendar(); applyCalendarAvailability(); }
  document.querySelectorAll('#menuPage [data-page="startPage"]').forEach(b=>b.addEventListener("click",e=>{e.preventDefault();showStartPage();}));
  document.querySelectorAll('#menuPage [data-page="calendarPage"]').forEach(b=>b.addEventListener("click",e=>{e.preventDefault();showCalendarPage();}));
});
/* menuNavV11 */

/* v12FridayCalendarFallback */
function applyFridayCalendarRule() {
  const calendar = document.getElementById("calendar");
  if (!calendar) return;

  const today = new Date();
  if (today.getDay() !== 5) return;

  const nextMonday = new Date(
    today.getFullYear(), today.getMonth(), today.getDate() + 3
  );
  nextMonday.setHours(0,0,0,0);

  for (let i = 0; i < 5; i++) {
    const d = new Date(nextMonday);
    d.setDate(nextMonday.getDate() + i);

    const dd = String(d.getDate()).padStart(2,"0");
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const yyyy = d.getFullYear();
    const iso = `${yyyy}-${mm}-${dd}`;
    const de = `${dd}.${mm}.${yyyy}`;

    calendar.querySelectorAll(
      `[data-date="${iso}"], [data-date="${de}"], ` +
      `[data-date-string="${iso}"], [data-date-string="${de}"], ` +
      `[data-date-value="${iso}"], [data-date-value="${de}"]`
    ).forEach(function(cell) {
      cell.classList.remove("inactive-gray","inactive-red","past","inactive");
      cell.classList.add("active-green");
      cell.disabled = false;
      cell.removeAttribute("aria-disabled");
    });
  }
}

document.addEventListener("DOMContentLoaded", function() {
  applyFridayCalendarRule();
});
