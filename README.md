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

Date | Menu | Meal | tawa_images

`tawa_orders`:

Menu | Amount | Date of Order | Date of Menu | Price | Surname | Street | House Number | Zipcode | Email | Description

## Important

The current backend stores one row per ordered menu with amount > 0. `Price` is the line total (amount × €8).

The customer confirmation email is implemented as a normal confirmation email. It tells the customer to reply with the Order ID for a change/cancellation request. Automated cancellation/change processing is intentionally not included in this first version.


V15: menu-page loading state and navigation cleanup; menu content remains hidden until the selected date's menus are loaded, and Lieferdetails starts collapsed.


## Meal pictures from Google Drive

Meal pictures are loaded from a Google Drive folder named **tawa_images** instead of from URLs stored in the `tawa_images` column.

In the `tawa_menu` sheet, the `tawa_images` value must exactly match the Google Drive file name (without the extension), for example:

`21.09.2026_Menü 1_Türkisch Dumpling`

The corresponding image file must be stored in the **tawa_images** folder. The Apps Script resolves the file name to a Google Drive thumbnail URL and caches the result. The image itself is loaded directly by the browser, so the Apps Script does not transfer the image bytes.

### Google Drive setup

1. Create a folder named **tawa_images** in Google Drive.
2. Upload the meal images into this folder.
3. Give the folder/file access that allows the public website to display the images (for example, **Anyone with the link – Viewer**).
4. In `tawa_menu`, put the exact image file designation in `tawa_images`. The file extension may be present on the actual Drive file; the spreadsheet value should be the base file name.
5. Keep each designation unique.

No Drive folder ID needs to be entered in the code; the Apps Script finds the folder by the configured name and caches its ID. If the folder is renamed, update `MEAL_PICTURE_FOLDER_NAME` in `Code.gs`.
