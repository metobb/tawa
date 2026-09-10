# tawa food order website

Architecture:

- GitHub Pages: public HTML/CSS/JS frontend
- Google Apps Script: API/backend
- Google Sheets: menu and order databases
- Gmail/Apps Script MailApp: admin + customer confirmation emails

## Files

- `index.html` — website structure
- `style.css` — design
- `script.js` — calendar, menu loading and order submission
- `Code.gs` — Google Apps Script backend

## Before deployment

1. Create Google Sheet `tawa_menu` with tab `tawa_menu`.
2. Create Google Sheet `tawa_orders` with tab `tawa_orders`.
3. Copy both spreadsheet IDs into `Code.gs`.
4. Deploy `Code.gs` as a Web app.
5. Copy the Web App `/exec` URL into `script.js` as `API_URL`.
6. Commit all frontend files to GitHub.
7. Enable GitHub Pages for the repository.
8. Test menu loading and test orders.

## Sheet headers

`tawa_menu`:

Date | Menu | Meal | Meal Picture

`tawa_orders`:

Menu | Amount | Date of Order | Date of Menu | Price | Surname | Street | House Number | Zipcode | Email | Description

## Important

The current backend stores one row per ordered menu with amount > 0. `Price` is the line total (amount × €8).

The customer confirmation email is implemented as a normal confirmation email. It tells the customer to reply with the Order ID for a change/cancellation request. Automated cancellation/change processing is intentionally not included in this first version.
