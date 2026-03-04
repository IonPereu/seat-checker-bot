require("dotenv").config();
const { chromium } = require("playwright");
const axios = require("axios");
const fs = require("fs");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const SITE_URL = process.env.SITE_URL;
const ELEMENT_XPATH = process.env.ELEMENT_XPATH;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: "storage.json" });
  const page = await context.newPage();

  await page.goto(SITE_URL);

  // 🔹 Retry până la 3 ori dacă elementele nu există
  let count = 0;
  let found = false;
  for (let i = 0; i < 3; i++) {
    try {
      await page.waitForSelector(ELEMENT_XPATH, { timeout: 5000 });
      count = await page.locator(ELEMENT_XPATH).count();
      if (count > 0) {
        found = true;
        break;
      }
    } catch (e) {
      console.log(`Încercarea ${i + 1}: elementele încă nu există`);
    }
  }

  if (!found) {
    console.log("⚠️ Elemente nu au apărut după 3 încercări. Scriptul nu va continua.");
    await browser.close();
    return;
  }

  console.log("Număr elemente:", count);

  let lastValue = null;
  if (fs.existsSync("last.json")) {
    lastValue = JSON.parse(fs.readFileSync("last.json")).value;
  }

  if (lastValue !== null && lastValue !== count) {
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text: `⚠️ Schimbare detectată!\nVeche: ${lastValue}\nNouă: ${count}`
    });
  }

  fs.writeFileSync("last.json", JSON.stringify({ value: count }));

  await browser.close();
})();
