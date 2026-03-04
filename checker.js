require("dotenv").config();
const { chromium } = require("playwright");
const axios = require("axios");
const fs = require("fs");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const SITE_URL = process.env.SITE_URL;
const ELEMENT_XPATH = process.env.ELEMENT_XPATH;

// Același path ca în workflow (cache .seat-checker-state/) — în Actions se restaurează din cache.
const LAST_STATE_FILE = ".seat-checker-state/last.json";

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

  // --- ORDINEA OPERAȚIILOR ---
  // 1. CITIRE: valoarea din rularea precedentă (din .seat-checker-state/last.json, restaurat din cache în Actions)
  let lastValue = null;
  if (fs.existsSync(LAST_STATE_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(LAST_STATE_FILE, "utf8"));
      const val = parsed?.value;
      if (typeof val === "number" && !Number.isNaN(val)) {
        lastValue = val;
      }
    } catch (e) {
      console.warn("last.json invalid sau lipsă, se consideră prima verificare:", e.message);
    }
  }

  // 2. Calculează diferența: null = prima verificare, 0 = neschimbat, != 0 = s-a schimbat
  let difference = null;
  if (lastValue !== null) {
    difference = count - lastValue;
  }

  // Mesaj doar când numărul s-a schimbat (difference !== 0). Fără mesaj la prima verificare sau când e 0.
  const shouldSend = difference !== null && difference !== 0;

  // Log clar pentru debug (în Actions sau local)
  console.log(
    `📋 lastValue=${lastValue ?? "lipsă"} | count=${count} | difference=${difference ?? "primă verificare"} | trimite mesaj=${shouldSend}`
  );

  // 3. Formează mesajul (doar pentru cazurile când îl trimitem)
  let message = `📍 URL: ${SITE_URL}\n`;
  message += `🪑 Locuri ocupate: ${count}\n`;
  if (difference !== null) {
    const diffSign = difference > 0 ? "+" : "";
    message += `📊 Diferență: ${diffSign}${difference} (${lastValue} → ${count})`;
  } else {
    message += `📊 Prima verificare`;
  }

  // 4. Trimite mesajul DOAR când numărul s-a schimbat (difference !== 0)
  if (shouldSend && CHAT_ID) {
    try {
      await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        chat_id: CHAT_ID,
        text: message
      });
      console.log("✅ Mesaj trimis cu succes în grup!");
    } catch (error) {
      console.error("❌ Eroare la trimiterea mesajului în grup:", error.message);
      if (error.response?.data) {
        console.error("   Răspuns API:", JSON.stringify(error.response.data));
      }
    }
  } else if (!shouldSend) {
    console.log("⏭️ Numărul neschimbat (primă verificare sau diferență 0), mesajul nu a fost trimis.");
  } else if (!CHAT_ID) {
    console.log("⚠️ CHAT_ID lipsește. Mesajul nu va fi trimis.");
  }

  // 5. SALVARE: scriem count curent în .seat-checker-state/last.json (după trimiterea mesajului).
  //    În Actions, pasul "Save last value" salvează acest director în cache pentru următoarea rulare.
  const stateDir = ".seat-checker-state";
  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, { recursive: true });
  }
  fs.writeFileSync(LAST_STATE_FILE, JSON.stringify({ value: count }));

  await browser.close();
})();
