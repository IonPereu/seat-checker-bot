require("dotenv").config();
const axios = require("axios");
const fs = require("fs");

const BOT_TOKEN = process.env.BOT_TOKEN;
const USERS_FILE = "users.json";

// Funcție pentru încărcarea utilizatorilor
function loadUsers() {
  if (fs.existsSync(USERS_FILE)) {
    try {
      const data = fs.readFileSync(USERS_FILE, "utf8");
      return JSON.parse(data);
    } catch (error) {
      console.error("Eroare la citirea users.json:", error.message);
      return { users: [] };
    }
  }
  return { users: [] };
}

// Funcție pentru salvarea utilizatorilor
function saveUsers(usersData) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(usersData, null, 2));
}

// Funcție pentru adăugarea unui utilizator
function addUser(chatId, username = null) {
  const usersData = loadUsers();
  
  // Verifică dacă utilizatorul există deja
  if (!usersData.users.some(user => user.chatId === chatId)) {
    usersData.users.push({
      chatId: chatId,
      username: username,
      joinedAt: new Date().toISOString()
    });
    saveUsers(usersData);
    return true; // Utilizator nou adăugat
  }
  return false; // Utilizator deja există
}

// Funcție pentru obținerea URL-ului botului
function getBotUrl() {
  return `https://t.me/${process.env.BOT_USERNAME || "your_bot"}`;
}

// Funcție pentru procesarea comenzilor
async function handleCommand(update) {
  const message = update.message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const text = message.text.trim();
  const username = message.from?.username || message.from?.first_name || "Utilizator";

  if (text === "/start") {
    const isNew = addUser(chatId, username);
    
    const welcomeMessage = isNew
      ? `✅ Bun venit! Ai fost înregistrat cu succes.\n\nVei primi notificări despre disponibilitatea locurilor.`
      : `ℹ️ Ești deja înregistrat! Vei continua să primești notificări.`;

    try {
      await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text: welcomeMessage
      });
    } catch (error) {
      console.error("Eroare la trimiterea mesajului de bun venit:", error.message);
    }
  } else if (text === "/status") {
    const usersData = loadUsers();
    const totalUsers = usersData.users.length;
    
    try {
      await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text: `📊 Statistici:\n👥 Utilizatori înregistrați: ${totalUsers}`
      });
    } catch (error) {
      console.error("Eroare la trimiterea statusului:", error.message);
    }
  }
}

// Funcție principală pentru polling
async function startBot() {
  console.log("🤖 Bot pornit! Aștept comenzi...");
  
  let offset = 0;

  while (true) {
    try {
      const response = await axios.get(
        `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`,
        {
          params: {
            offset: offset,
            timeout: 30
          }
        }
      );

      if (response.data.ok && response.data.result.length > 0) {
        for (const update of response.data.result) {
          await handleCommand(update);
          offset = update.update_id + 1;
        }
      }
    } catch (error) {
      console.error("Eroare la polling:", error.message);
      await new Promise(resolve => setTimeout(resolve, 5000)); // Așteaptă 5 secunde înainte de retry
    }
  }
}

// Pornește botul
if (require.main === module) {
  if (!BOT_TOKEN) {
    console.error("❌ BOT_TOKEN lipsește din .env!");
    process.exit(1);
  }

  startBot().catch(error => {
    console.error("Eroare fatală:", error);
    process.exit(1);
  });
}

module.exports = { loadUsers, addUser, saveUsers };
