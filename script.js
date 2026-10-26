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
const selectedCalendarDates = new Set();
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

function createPreviewImage(meal, menu) {
  const images = document.createElement("div");
  images.className = "start-preview-images single-image";

  const frame = document.createElement("div");
  frame.className = "start-preview-image-frame";

  if (meal && meal.picture) {
    const img = document.createElement("img");
    img.className = "start-preview-image";
    img.alt = meal.meal || menu.menu;
    img.loading = "lazy";
    img.decoding = "async";
    img.fetchPriority = "low";
    img.width = 170;
    img.height = 120;

    const originalUrl = meal.picture;
    img.src = createPreviewImageUrl(originalUrl);

    img.onerror = () => {
      if (img.src !== originalUrl) {
        img.src = originalUrl;
      } else {
        img.style.display = "none";
      }
    };

    frame.appendChild(img);
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "start-preview-image";
    placeholder.setAttribute("aria-hidden", "true");
    frame.appendChild(placeholder);
  }

  const mealCaption = document.createElement("div");
  mealCaption.className = "start-preview-meal-caption";
  mealCaption.textContent = meal && meal.meal ? meal.meal : "";
  frame.appendChild(mealCaption);

  images.appendChild(frame);
  return images;
}

function buildStartPreviewCard(date, menus = null, loading = false) {
  const dateString = displayDate(date);

  const card = document.createElement("article");
  card.className = "start-preview-card";
  card.dataset.date = dateString;
  card.tabIndex = loading ? -1 : 0;
  card.setAttribute("aria-label", `Menüvorschau für ${germanDayTitle(date)} öffnen`);

  if (!loading) {
    card.setAttribute("role", "button");
    card.addEventListener("click", () => openPreviewDate(dateString));
    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openPreviewDate(dateString);
      }
    });
  }

  if (loading) {
    card.classList.add("is-loading");
    card.removeAttribute("role");

    const loadingArea = document.createElement("div");
    loadingArea.className = "start-preview-card-loading";
    loadingArea.setAttribute("aria-label", `Menüs für ${germanDayTitle(date)} werden geladen`);
    loadingArea.innerHTML = '<span class="start-preview-spinner" aria-hidden="true"></span>';
    card.appendChild(loadingArea);
    return card;
  }

  const dayTitle = document.createElement("h3");
  dayTitle.className = "start-preview-day";
  dayTitle.textContent = germanDayTitle(date);
  card.appendChild(dayTitle);

  const menusRow = document.createElement("div");
  menusRow.className = "start-preview-menus-row";

  menus.slice(0, 2).forEach(menu => {
    const menuSection = document.createElement("div");
    menuSection.className = "start-preview-menu";

    const menuName = document.createElement("h4");
    menuName.className = "start-preview-menu-name";
    menuName.textContent = menu.menu;
    menuSection.appendChild(menuName);

    const meal = (menu.meals || [])[0] || null;
    const images = createPreviewImage(meal, menu);

    menuSection.appendChild(images);
    menusRow.appendChild(menuSection);
  });

  card.appendChild(menusRow);

  return card;
}

function createPreviewImageUrl(url) {
  if (!url) return url;

  // Google Drive thumbnail endpoint:
  // https://drive.google.com/thumbnail?id=FILE_ID&sz=w320
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (driveMatch) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveMatch[1])}&sz=w320`;
  }

  const idMatch = url.match(/[?&]id=([^&]+)/i);
  if (url.includes("drive.google.com") && idMatch) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(idMatch[1])}&sz=w320`;
  }

  return url;
}

async function renderStartMenuPreviews() {
  if (!startMenuPreviews || !startPreviewLoading) return;

  const activeDates = getActiveCalendarDates(new Date());

  startMenuPreviews.innerHTML = "";
  startPreviewLoading.hidden = true;

  if (activeDates.length === 0) {
    const empty = document.createElement("div");
    empty.className = "start-preview-empty";
    empty.textContent = "Aktuell sind keine Menüs zur Vorschau verfügbar.";
    startMenuPreviews.appendChild(empty);
    return;
  }

  // Create every active-day window first, in chronological order.
  // Each window has its own spinner while its date-specific data is loading.
  const cards = activeDates.map(date => {
    const card = buildStartPreviewCard(date, null, true);
    startMenuPreviews.appendChild(card);
    return { date, card };
  });

  // Load each date independently. The position of the cards never changes,
  // so 24.09 always remains above 25.09, etc.
  await Promise.all(
    cards.map(async ({ date, card }) => {
      const dateString = displayDate(date);

      try {
        const menus = await fetchMenusForDate(dateString);

        const loadedCard = buildStartPreviewCard(date, menus, false);
        card.replaceWith(loadedCard);
      } catch (error) {
        console.error(`Preview loading failed for ${dateString}:`, error);

        // Keep the same date window and replace the spinner with a simple
        // loading/error hint instead of removing the window.
        card.classList.remove("is-loading");
        card.tabIndex = -1;
        card.removeAttribute("role");
        card.innerHTML = "";

        const dayTitle = document.createElement("h3");
        dayTitle.className = "start-preview-day";
        dayTitle.textContent = germanDayTitle(date);
        card.appendChild(dayTitle);

        const message = document.createElement("div");
        message.className = "start-preview-empty";
        message.textContent = "Menüs konnten nicht geladen werden.";
        card.appendChild(message);
      }
    })
  );
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
  // Menu previews are intentionally not rendered on the start page.
}

function showCalendarPage() {
  confirmationModal.classList.add("hidden");
  errorModal.classList.add("hidden");
  leaveModal.classList.add("hidden");
  showPage("calendarPage");
  renderCalendar();
  renderStartMenuPreviews();
}

function openPreviewDate(dateString) {
  // A preview is a shortcut into that specific date's menu section.
  // Keep the calendar selection in sync with the date being opened.
  selectedCalendarDates.clear();
  selectedCalendarDates.add(dateString);
  updateCalendarSelectionUI();
  showOrderPage([dateString], dateString);
}

function showOrderPage(dateStrings, expandedDateString = null) {
  confirmationModal.classList.add("hidden");
  errorModal.classList.add("hidden");
  leaveModal.classList.add("hidden");

  const dates = [...new Set(dateStrings)].sort((a, b) => {
    const [ad, am, ay] = a.split(".").map(Number);
    const [bd, bm, by] = b.split(".").map(Number);
    return new Date(ay, am - 1, ad) - new Date(by, bm - 1, bd);
  });
  if (!dates.length) return;

  selectedMenuDate = dates[0];
  selectedDateTitle.textContent = "Menüs auswählen";
  showPage("menuPage");
  prepareMenuLoadingState();
  loadMenusForDates(dates, expandedDateString);
}

function toggleCalendarDate(dateString) {
  if (selectedCalendarDates.has(dateString)) selectedCalendarDates.delete(dateString);
  else selectedCalendarDates.add(dateString);
  updateCalendarSelectionUI();
}

function updateCalendarSelectionUI() {
  calendar.querySelectorAll(".calendar-day[data-date]").forEach(button => {
    const selected = selectedCalendarDates.has(button.dataset.date);
    button.classList.toggle("selected-date", selected);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  });
  const nextButton = document.getElementById("nextCalendarButton");
  if (nextButton) nextButton.disabled = selectedCalendarDates.size === 0;
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
      button.addEventListener("click", () => toggleCalendarDate(dateString));
    } else {
      button.classList.add("inactive-gray");
    }

    calendar.appendChild(button);
  }
  updateCalendarSelectionUI();
}

function prepareMenuLoadingState() {
  menusContainer.innerHTML = "";
  currentMenus = [];
  updateTotal();
  resetDeliveryDetails();
  orderContent.classList.add("hidden");
  menuLoadingBar.hidden = false;
}

async function loadMenusForDates(dateStrings, expandedDateString = null) {
  try {
    const dateResults = await Promise.all(dateStrings.map(async dateString => {
      const menus = await fetchMenusForDate(dateString);
      if (!Array.isArray(menus) || menus.length !== 2) {
        throw new Error(menus.length === 0
          ? `Für ${dateString} sind keine Menüs verfügbar.`
          : `Für ${dateString} wurden ${menus.length} statt 2 Menüs gefunden.`);
      }
      return { dateString, menus };
    }));

    menusContainer.innerHTML = "";
    dateResults.forEach(({ dateString, menus }) => {
      const datePanel = document.createElement("section");
      datePanel.className = "date-menu-panel";

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "date-menu-toggle";
      const initiallyExpanded = dateString === expandedDateString;
      toggle.setAttribute("aria-expanded", String(initiallyExpanded));
      toggle.classList.toggle("expanded", initiallyExpanded);
      toggle.innerHTML = `<span class="date-menu-title"></span><span class="date-menu-chevron" aria-hidden="true">▼</span>`;
      toggle.querySelector(".date-menu-title").textContent = germanDayTitle(parseDisplayDate(dateString));

      const panel = document.createElement("div");
      panel.className = "date-menu-content";
      panel.hidden = !initiallyExpanded;
      const dayMenus = document.createElement("div");
      dayMenus.className = "menus-container date-menus-container";
      renderMenus(dateString, menus, dayMenus);
      panel.appendChild(dayMenus);

      toggle.addEventListener("click", () => {
        const expanded = toggle.getAttribute("aria-expanded") === "true";
        toggle.setAttribute("aria-expanded", String(!expanded));
        panel.hidden = expanded;
        toggle.classList.toggle("expanded", !expanded);
      });

      datePanel.appendChild(toggle);
      datePanel.appendChild(panel);
      menusContainer.appendChild(datePanel);
    });

    resetDeliveryDetails();
    menuLoadingBar.hidden = true;
    orderContent.classList.remove("hidden");
  } catch (error) {
    console.error("Menu loading failed:", error);
    menuLoadingBar.hidden = true;
    orderContent.classList.add("hidden");
    showError("Die Menüs konnten nicht geladen werden. Bitte versuchen Sie es erneut.");
  }
}

function parseDisplayDate(dateString) {
  const [day, month, year] = dateString.split(".").map(Number);
  return new Date(year, month - 1, day);
}

function renderMenus(dateString, menus, targetContainer) {
  menus.forEach((menu, index) => {
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

      const imageStage = document.createElement("div");
      imageStage.className = "meal-image-stage";

      const img = document.createElement("img");
      img.src = meal.picture || "";
      img.alt = meal.meal;
      img.loading = "eager";
      img.decoding = "async";
      img.onerror = () => {
        img.style.visibility = "hidden";
      };

      const ingredientsOverlay = document.createElement("div");
      ingredientsOverlay.className = "meal-ingredients-overlay";
      ingredientsOverlay.hidden = true;

      const ingredientsText = document.createElement("div");
      ingredientsText.className = "meal-ingredients-text";
      ingredientsText.textContent = String(meal.ingredients || "").trim() || "Keine Zutaten angegeben.";
      ingredientsOverlay.appendChild(ingredientsText);

      const toggleButton = document.createElement("button");
      toggleButton.className = "meal-ingredients-toggle";
      toggleButton.type = "button";
      toggleButton.setAttribute("aria-label", `Zutaten für ${meal.meal} anzeigen`);
      toggleButton.setAttribute("aria-pressed", "false");
      toggleButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5v13l10-6.5z"></path></svg>';
      toggleButton.addEventListener("click", () => {
        const showIngredients = ingredientsOverlay.hidden;
        ingredientsOverlay.hidden = !showIngredients;
        toggleButton.classList.toggle("is-active", showIngredients);
        toggleButton.setAttribute("aria-pressed", String(showIngredients));
        toggleButton.setAttribute("aria-label", showIngredients
          ? `Bild von ${meal.meal} anzeigen`
          : `Zutaten für ${meal.meal} anzeigen`);
      });

      imageStage.appendChild(img);
      imageStage.appendChild(ingredientsOverlay);
      imageStage.appendChild(toggleButton);

      const name = document.createElement("p");
      name.className = "meal-name";
      name.textContent = meal.meal;

      mealBox.appendChild(imageStage);
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
    select.dataset.menuName = menu.menu;
    select.dataset.menuDate = dateString;
    select.setAttribute("aria-label", `Anzahl für ${menu.menu} am ${dateString}`);

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
    targetContainer.appendChild(card);
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
      menu: select.dataset.menuName || "",
      dateOfMenu: select.dataset.menuDate || "",
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
    return `${item.dateOfMenu} – ${item.menu}: ${item.amount} x ${PRICE_PER_MENU.toFixed(2)} € = ${lineTotal.toFixed(2)} €`;
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
    dateOfMenu: selectedOrders[0]?.dateOfMenu || selectedMenuDate,
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
  selectedCalendarDates.clear();
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
  const nextCalendarButton = document.getElementById("nextCalendarButton");

  if (dinnerButton) dinnerButton.addEventListener("click", showCalendarPage);
  if (calendarHomeButton) calendarHomeButton.addEventListener("click", showStartPage);
  if (nextCalendarButton) nextCalendarButton.addEventListener("click", () => {
    if (selectedCalendarDates.size === 0) return;
    showOrderPage([...selectedCalendarDates]);
  });
  if (deliveryToggle) deliveryToggle.addEventListener("click", toggleDeliveryDetails);

  bindNavigationButtons();
  orderForm.addEventListener("submit", submitOrder);

  // Start page is the initial page.
  showStartPage();
});
