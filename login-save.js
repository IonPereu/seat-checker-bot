require("dotenv").config();
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // mergi pe pagina de login
  await page.goto("https://iticket.md/login");

  // Completează formularul
  await page.fill('input[wire\\:model="email"]', process.env.SITE_EMAIL);
  await page.fill('input[wire\\:model="password"]', process.env.SITE_PASSWORD);

  // Click pe butonul de login
  await page.click('input[name="site-login-button"]');

  // Așteaptă să se încarce pagina după login
  await page.waitForNavigation({ waitUntil: "networkidle" });

  // Salvează cookies și sesiunea
  await context.storageState({ path: "storage.json" });

  console.log("Login realizat și storage salvat!");
  await browser.close();
})();
