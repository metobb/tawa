/**
 * TAWA Google Apps Script backend
 *
 * 1. Create two Google Sheets:
 *      - tawa_menu
 *      - tawa_orders
 *    Each must have one sheet/tab with exactly the same name.
 *
 * 2. Put the spreadsheet IDs below.
 *
 * 3. Deploy this project as a Web app:
 *      Execute as: Me
 *      Who has access: Anyone
 *
 * 4. Put the deployment /exec URL into script.js as API_URL.
 */

const CONFIG = {
  MENU_SPREADSHEET_ID: "1k2GvbQyOhE7yhc9yiEXVLvAKtScrt8qpFgsxIHc4l5g",
  ORDERS_SPREADSHEET_ID: "1uHcqu0btdc444wZ40e4lPdoNijWa3E2bquIInF-JW-0",
  MENU_SHEET_NAME: "tawa_menu",
  ORDERS_SHEET_NAME: "tawa_orders",
  ADMIN_EMAIL: "meteboncukcu@gmail.com",
  PRICE_PER_MENU: 8,
  TIME_ZONE: Session.getScriptTimeZone() || "Europe/Berlin"
};

function doGet(e) {
  try {
    const action = e?.parameter?.action || "";

    if (action === "menus") {
      const date = String(e.parameter.date || "").trim();
      if (!/^\d{2}\.\d{2}\.\d{4}$/.test(date)) {
        return jsonResponse({ ok: false, error: "Invalid date format." });
      }

      return jsonResponse({
        ok: true,
        menus: getMenusForDate(date)
      });
    }

    return jsonResponse({
      ok: true,
      service: "tawa",
      message: "TAWA API is running."
    });
  } catch (error) {
    console.error(error);
    return jsonResponse({ ok: false, error: String(error) });
  }
}

function doPost(e) {
  try {
    const action = e?.parameter?.action || "";
    if (action !== "order") {
      return jsonResponse({ ok: false, error: "Unknown action." });
    }

    const rawPayload = e.parameter?.payload;
    if (!rawPayload) {
      return jsonResponse({ ok: false, error: "Missing order payload." });
    }

    const payload = JSON.parse(rawPayload);
    const result = saveOrder(payload);

    return jsonResponse({
      ok: true,
      orderId: result.orderId,
      rows: result.rows
    });
  } catch (error) {
    console.error(error);
    return jsonResponse({ ok: false, error: String(error) });
  }
}

function getMenusForDate(dateString) {
  const sheet = SpreadsheetApp
    .openById(CONFIG.MENU_SPREADSHEET_ID)
    .getSheetByName(CONFIG.MENU_SHEET_NAME);

  if (!sheet) throw new Error(`Sheet "${CONFIG.MENU_SHEET_NAME}" was not found.`);

  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return [];

  const headers = values[0].map(String);
  const dateCol = headers.indexOf("Date");
  const menuCol = headers.indexOf("Menu");
  const mealCol = headers.indexOf("Meal");
  const pictureCol = headers.indexOf("Meal Picture");

  if ([dateCol, menuCol, mealCol, pictureCol].some(index => index === -1)) {
    throw new Error("tawa_menu must contain: Date, Menu, Meal, Meal Picture.");
  }

  const grouped = {};

  values.slice(1).forEach(row => {
    const rowDate = String(row[dateCol]).trim();
    if (rowDate !== dateString) return;

    const menuName = String(row[menuCol]).trim();
    const mealName = String(row[mealCol]).trim();
    const picture = String(row[pictureCol]).trim();

    if (!menuName || !mealName) return;

    if (!grouped[menuName]) {
      grouped[menuName] = {
        menu: menuName,
        meals: []
      };
    }

    grouped[menuName].meals.push({
      meal: mealName,
      picture: picture
    });
  });

  return Object.values(grouped).slice(0, 2);
}

function saveOrder(payload) {
  validateOrderPayload(payload);

  const orders = payload.orders.filter(item => Number(item.amount) > 0);
  const dateOfOrder = Utilities.formatDate(
    new Date(),
    CONFIG.TIME_ZONE,
    "dd.MM.yyyy HH:mm:ss"
  );

  const orderId = Utilities.getUuid();
  const totalOrderPrice = orders.reduce(
    (sum, item) => sum + Number(item.amount) * CONFIG.PRICE_PER_MENU,
    0
  );

  const sheet = SpreadsheetApp
    .openById(CONFIG.ORDERS_SPREADSHEET_ID)
    .getSheetByName(CONFIG.ORDERS_SHEET_NAME);

  if (!sheet) throw new Error(`Sheet "${CONFIG.ORDERS_SHEET_NAME}" was not found.`);

  const rows = orders.map(item => [
    item.menu,
    Number(item.amount),
    dateOfOrder,
    payload.dateOfMenu,
    Number(item.amount) * CONFIG.PRICE_PER_MENU,
    payload.surname,
    payload.street,
    payload.houseNumber,
    payload.zipcode,
    payload.email,
    payload.description || ""
  ]);

  if (rows.length > 0) {
    sheet.getRange(
      sheet.getLastRow() + 1,
      1,
      rows.length,
      rows[0].length
    ).setValues(rows);
  }

  sendAdminEmail(orderId, payload, orders, totalOrderPrice, dateOfOrder);
  sendCustomerEmail(orderId, payload, orders, totalOrderPrice, dateOfOrder);

  return {
    orderId: orderId,
    rows: rows.length
  };
}

function validateOrderPayload(payload) {
  if (!payload || !Array.isArray(payload.orders) || payload.orders.length === 0) {
    throw new Error("At least one menu must be ordered.");
  }

  if (!/^\d{2}\.\d{2}\.\d{4}$/.test(String(payload.dateOfMenu || ""))) {
    throw new Error("Invalid menu date.");
  }

  const required = ["surname", "street", "houseNumber", "zipcode", "email"];
  required.forEach(field => {
    if (!String(payload[field] || "").trim()) {
      throw new Error(`Missing required field: ${field}.`);
    }
  });

  if (payload.street !== "Vereinsstraße") {
    throw new Error("Invalid street.");
  }

  const email = String(payload.email).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Invalid email address.");
  }

  payload.orders.forEach(item => {
    const amount = Number(item.amount);
    if (!String(item.menu || "").trim()) {
      throw new Error("Invalid menu.");
    }
    if (!Number.isInteger(amount) || amount < 1 || amount > 10) {
      throw new Error("Menu amount must be between 1 and 10.");
    }
  });
}

function sendAdminEmail(orderId, payload, orders, total, dateOfOrder) {
  const lines = [
    `Order ID: ${orderId}`,
    `Date of order: ${dateOfOrder}`,
    `Date of menu: ${payload.dateOfMenu}`,
    "",
    "Customer:",
    `Surname: ${payload.surname}`,
    `Street: ${payload.street}`,
    `House Number: ${payload.houseNumber}`,
    `Zipcode: ${payload.zipcode}`,
    `Email: ${payload.email}`,
    `Description: ${payload.description || "-"}`,
    "",
    "Menus:"
  ];

  orders.forEach(item => {
    lines.push(
      `- ${item.menu}: ${item.amount} x ${CONFIG.PRICE_PER_MENU.toFixed(2)} € = ${(item.amount * CONFIG.PRICE_PER_MENU).toFixed(2)} €`
    );
  });

  lines.push("", `Total: ${total.toFixed(2)} €`);

  MailApp.sendEmail(
    CONFIG.ADMIN_EMAIL,
    `tawa order ${orderId} – ${payload.dateOfMenu}`,
    lines.join("\n")
  );
}

function sendCustomerEmail(orderId, payload, orders, total, dateOfOrder) {
  const lines = [
    "Thank you for your tawa order.",
    "",
    `Order ID: ${orderId}`,
    `Date of order: ${dateOfOrder}`,
    `Date of menu: ${payload.dateOfMenu}`,
    "",
    "Ordered menus:"
  ];

  orders.forEach(item => {
    lines.push(
      `- ${item.menu}: ${item.amount} x ${CONFIG.PRICE_PER_MENU.toFixed(2)} € = ${(item.amount * CONFIG.PRICE_PER_MENU).toFixed(2)} €`
    );
  });

  lines.push(
    "",
    `Total: ${total.toFixed(2)} €`,
    "",
    "If you need to change or cancel the order, please reply to this email and include your Order ID."
  );

  MailApp.sendEmail(
    payload.email,
    `tawa order confirmation ${orderId}`,
    lines.join("\n"),
    {
      replyTo: CONFIG.ADMIN_EMAIL,
      name: "tawa"
    }
  );
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
