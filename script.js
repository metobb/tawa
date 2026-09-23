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
const orderConfirmModal = document.getElementById("orderConfirmModal");
const orderConfirmMessage = document.getElementById("orderConfirmMessage");
const orderConfirmButton = document.getElementById("orderConfirmButton");
const orderCancelButton = document.getElementById("orderCancelButton");
const errorModal = document.getElementById("errorModal");
const errorTitle = document.getElementById("errorTitle");
const errorMessage = document.getElementById("errorMessage");
const leaveModal = document.getElementById("leaveModal");
const leaveYesButton = document.getElementById("leaveYesButton");
const leaveNoButton = document.getElementById("leaveNoButton");
const startMenuPreviews = document.getElementById("startMenuPreviews");
const startPreviewLoading = document.getElementById("startPreviewLoading");

let selectedMenuDate = "";
let currentMenus = [];
let pendingLeavePage = "";
let pendingOrderPayload = null;
const startPreviewCache = new Map();

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
  const todayDayOfWeek = t.getDay();

  // Saturday and Sunday are always unavailable.
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return "gray";
  }

  // On Friday, Saturday, and Sunday, the complete following
  // Monday-Friday is available.
  if (todayDayOfWeek === 5 || todayDayOfWeek === 6 || todayDayOfWeek === 0) {
    const daysUntilNextMonday = todayDayOfWeek === 5 ? 3 : todayDayOfWeek === 6 ? 2 : 1;

    const nextMonday = new Date(t);
    nextMonday.setDate(t.getDate() + daysUntilNextMonday);

    const nextFriday = new Date(nextMonday);
    nextFriday.setDate(nextMonday.getDate() + 4);

    if (d >= nextMonday && d <= nextFriday) {
      return "green";
    }

    return "gray";
  }

  // Monday-Thursday: only future weekdays in the current week are available.
  // Today, past days, weekends, and all other dates are gray/inactive.
  const currentMonday = mondayOfWeek(t);
  const dateMonday = mondayOfWeek(d);

  if (dateMonday.getTime() === currentMonday.getTime() && d > t) {
    return "green";
  }

  return "gray";
}

function getActiveCalendarDates(today = new Date()) {
  const t = dateOnly(today);
  const year = t.getFullYear();
  const month = t.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const activeDates = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    if (getCalendarState(date, t) === "green") {
      activeDates.push(date);
    }
  }

  return activeDates;
}

function germanDayTitle(date) {
  const weekday = new Intl.DateTimeFormat("de-DE", { weekday: "long" }).format(date);
  return `${weekday}, ${displayDate(date)}`;
}

async function fetchMenusForDate(dateString) {
  if (startPreviewCache.has(dateString)) {
    return startPreviewCache.get(dateString);
  }

  const request = (async () => {
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

    return Array.isArray(data.menus) ? data.menus : [];
  })();

  startPreviewCache.set(dateString, request);

  try {
    return await request;
  } catch (error) {
    startPreviewCache.delete(dateString);
    throw error;
  }
}

function buildStartPreviewCard(date, menus) {
  const dateString = displayDate(date);

  const card = document.createElement("article");
  card.className = "start-preview-card";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Menüs für ${germanDayTitle(date)} öffnen`);

  const dayTitle = document.createElement("h3");
  dayTitle.className = "start-preview-day";
  dayTitle.textContent = germanDayTitle(date);
  card.appendChild(dayTitle);

  menus.slice(0, 2).forEach(menu => {
    const menuSection = document.createElement("div");
    menuSection.className = "start-preview-menu";

    const menuName = document.createElement("h4");
    menuName.className = "start-preview-menu-name";
    menuName.textContent = menu.menu;
    menuSection.appendChild(menuName);

    const images = document.createElement("div");
    images.className = "start-preview-images";

    const mealsWithPictures = (menu.meals || []).filter(meal => meal.picture).slice(0, 2);
    if (mealsWithPictures.length === 1) {
      images.classList.add("single-image");
    }

    mealsWithPictures.forEach(meal => {
      const img = document.createElement("img");
      img.className = "start-preview-image";
      img.src = meal.picture;
      img.alt = meal.meal || menu.menu;
      img.loading = "lazy";
      img.decoding = "async";
      img.onerror = () => {
        img.style.display = "none";
      };
      images.appendChild(img);
    });

    menuSection.appendChild(images);
    card.appendChild(menuSection);
  });

  const openDate = () => showOrderPage(dateString);
  card.addEventListener("click", openDate);
  card.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDate();
    }
  });

  return card;
}

async function renderStartMenuPreviews() {
  if (!startMenuPreviews || !startPreviewLoading) return;

  const activeDates = getActiveCalendarDates(new Date());
  startMenuPreviews.innerHTML = "";

  if (activeDates.length === 0) {
    startPreviewLoading.hidden = true;
    const empty = document.createElement("div");
    empty.className = "start-preview-empty";
    empty.textContent = "Aktuell sind keine Menüs zur Vorschau verfügbar.";
    startMenuPreviews.appendChild(empty);
    return;
  }

  startPreviewLoading.hidden = false;

  const results = await Promise.all(
    activeDates.map(async date => {
      const dateString = displayDate(date);
      try {
        const menus = await fetchMenusForDate(dateString);
        return { date, menus, ok: menus.length > 0 };
      } catch (error) {
        console.error(`Preview loading failed for ${dateString}:`, error);
        return { date, menus: [], ok: false };
      }
    })
  );

  startMenuPreviews.innerHTML = "";

  results
    .filter(result => result.ok)
    .forEach(result => {
      startMenuPreviews.appendChild(buildStartPreviewCard(result.date, result.menus));
    });

  startPreviewLoading.hidden = true;

  if (!startMenuPreviews.children.length) {
    const empty = document.createElement("div");
    empty.className = "start-preview-empty";
    empty.textContent = "Die Menüvorschau konnte gerade nicht geladen werden.";
    startMenuPreviews.appendChild(empty);
  }
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
  renderStartMenuPreviews();
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

    const titleText = document.createElement("span");
    titleText.className = "menu-title-text";
    titleText.textContent = menu.menu;

    const titlePrice = document.createElement("span");
    titlePrice.className = "menu-title-price";
    titlePrice.textContent = `${PRICE_PER_MENU.toFixed(2)} €`;

    title.appendChild(titleText);
    title.appendChild(titlePrice);
    card.appendChild(title);

    const mealsGrid = document.createElement("div");
    mealsGrid.className = "meals-grid";

    (menu.meals || []).forEach(meal => {
      const mealBox = document.createElement("div");
      mealBox.className = "meal";

      const img = document.createElement("img");
      img.src = meal.picture;
      img.alt = meal.meal;
      img.loading = "eager";
      img.decoding = "async";
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

    // Quantity selector is intentionally rendered above the price.
    // The native select remains fully functional, while its visible UI is
    // styled as the same black/white-chevron pattern used by "Bestellen".
    const amountWrap = document.createElement("div");
    amountWrap.className = "menu-amount-wrap";

    const select = document.createElement("select");
    select.className = "menu-amount";
    select.dataset.menuIndex = String(index);
    select.setAttribute("aria-label", `Anzahl für ${menu.menu}`);

    const zero = document.createElement("option");
    zero.value = "0";
    zero.textContent = "0";
    select.appendChild(zero);

    for (let amount = 1; amount <= 10; amount++) {
      const option = document.createElement("option");
      option.value = String(amount);
      option.textContent = String(amount);
      select.appendChild(option);
    }

    const amountText = document.createElement("span");
    amountText.className = "menu-amount-text";
    amountText.textContent = "Anzahl";
    amountText.setAttribute("aria-hidden", "true");

    const amountChevron = document.createElement("span");
    amountChevron.className = "menu-amount-chevron";
    amountChevron.textContent = "▼";
    amountChevron.setAttribute("aria-hidden", "true");

    amountWrap.appendChild(select);
    amountWrap.appendChild(amountText);
    amountWrap.appendChild(amountChevron);

    const amountValue = document.createElement("div");
    amountValue.className = "menu-amount-value";
    amountValue.textContent = "0";
    amountValue.setAttribute("aria-live", "polite");
    amountValue.setAttribute("aria-label", `Ausgewählte Anzahl für ${menu.menu}`);

    const amountControlRow = document.createElement("div");
    amountControlRow.className = "menu-amount-control-row";
    amountControlRow.appendChild(amountWrap);
    amountControlRow.appendChild(amountValue);

    select.addEventListener("change", () => {
      amountValue.textContent = select.value;
      updateTotal();
    });

    // The price is displayed in the menu title, so there is no
    // additional price box below the quantity selector.
    controls.appendChild(amountControlRow);
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

function buildOrderConfirmationMessage(selectedOrders) {
  const lines = selectedOrders.map(item => {
    const lineTotal = item.amount * PRICE_PER_MENU;
    return `${item.menu}: ${item.amount} x ${PRICE_PER_MENU.toFixed(2)} € = ${lineTotal.toFixed(2)} €`;
  });

  const total = selectedOrders.reduce(
    (sum, item) => sum + item.amount * PRICE_PER_MENU,
    0
  );

  return `${lines.join("\n")}\n\nTotal: ${total.toFixed(2)} €\n\nAlles in Ordnung?`;
}

function showOrderConfirmation(payload) {
  pendingOrderPayload = payload;
  orderConfirmMessage.textContent = buildOrderConfirmationMessage(payload.orders);
  orderConfirmModal.classList.remove("hidden");
}

function cancelOrderConfirmation() {
  pendingOrderPayload = null;
  orderConfirmModal.classList.add("hidden");
}

async function finalizeOrder() {
  if (!pendingOrderPayload) return;

  const payload = pendingOrderPayload;
  orderConfirmButton.disabled = true;
  orderCancelButton.disabled = true;
  orderConfirmButton.textContent = "Wird gesendet…";

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

    pendingOrderPayload = null;
    orderConfirmModal.classList.add("hidden");
    confirmationModal.classList.remove("hidden");
  } catch (error) {
    console.error(error);
    showError("Die Bestellung konnte nicht abgeschlossen werden. Bitte versuchen Sie es erneut.");
  } finally {
    orderConfirmButton.disabled = false;
    orderCancelButton.disabled = false;
    orderConfirmButton.textContent = "Bestellen";
  }
}

async function submitOrder(event) {
  event.preventDefault();

  const selectedOrders = getSelectedOrders();
  if (selectedOrders.length === 0) {
    showError(
      "Bitte wählen Sie mindestens ein Menü aus.",
      "Kein Menü???",
      true
    );
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

  showOrderConfirmation(payload);
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

  if (orderConfirmButton) orderConfirmButton.addEventListener("click", finalizeOrder);
  if (orderCancelButton) orderCancelButton.addEventListener("click", cancelOrderConfirmation);

  document.getElementById("errorCloseButton").addEventListener("click", () => {
    errorModal.classList.add("hidden");
    errorTitle.textContent = "Es ist ein Fehler aufgetreten";
    errorMessage.classList.remove("large-error-text");
  });
}

function resetOrderPage() {
  pendingOrderPayload = null;
  if (orderConfirmModal) orderConfirmModal.classList.add("hidden");
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

function showError(message, title = "Es ist ein Fehler aufgetreten", largeText = false) {
  errorTitle.textContent = title;
  errorMessage.textContent = message;
  errorMessage.classList.toggle("large-error-text", largeText);
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
