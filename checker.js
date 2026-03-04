require("dotenv").config();
const { chromium } = require("playwright");
const axios = require("axios");
const fs = require("fs");

const BOT_TOKEN = process.env.BOT_TOKEN;
const SITE_URL = process.env.SITE_URL;
const ELEMENT_XPATH = process.env.ELEMENT_XPATH;
const USERS_FILE = "users.json";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: "storage.json" });
  const page = await context.newPage();

  await page.goto(SITE_URL);

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

  let difference = null;
  if (lastValue !== null) {
    difference = count - lastValue;
  }

  // Formează mesajul
  let message = `📍 URL: ${SITE_URL}\n`;
  message += `🪑 Locuri ocupate: ${count}\n`;
  
  if (difference !== null) {
    const diffSign = difference > 0 ? "+" : "";
    message += `📊 Diferență: ${diffSign}${difference} (${lastValue} → ${count})`;
  } else {
    message += `📊 Prima verificare`;
  }

  // Trimite mesajul tuturor utilizatorilor înregistrați
  let usersData = { users: [] };
  if (fs.existsSync(USERS_FILE)) {
    try {
      usersData = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
    } catch (error) {
      console.error("Eroare la citirea users.json:", error.message);
    }
  }

  if (usersData.users.length === 0) {
    console.log("⚠️ Nu există utilizatori înregistrați. Mesajul nu va fi trimis.");
  } else {
    let successCount = 0;
    let errorCount = 0;

    for (const user of usersData.users) {
      try {
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          chat_id: user.chatId,
          text: message
        });
        successCount++;
      } catch (error) {
        console.error(`Eroare la trimiterea mesajului către ${user.chatId}:`, error.message);
        errorCount++;
      }
    }

    console.log(`✅ Mesaje trimise: ${successCount} succes, ${errorCount} erori`);
  }

  fs.writeFileSync("last.json", JSON.stringify({ value: count }));

  await browser.close();
})();
