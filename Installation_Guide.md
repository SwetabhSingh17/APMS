# 🚀 How to Build Your Very Own Website! (A Guide for Smart Kids)

Hi there! 👋 Do you like building things with blocks? Today, we are going to build a **real website** on your computer. It is super fun and very easy. 

Just ask an adult to help you read these instructions, and let's get building! 🧱

---

## 📥 Step 0: Getting the Code!

First, we need to download the code to your computer! 
You can either download it as a ZIP file from GitHub and extract it, or if you have Git installed, you can open your Terminal/Command Prompt and type:

```bash
git clone https://github.com/SwetabhSingh17/APMS.git
cd APMS
```

---

## 🎒 Step 1: Getting Our Tools Ready!

We have a special "Setup Assistant" that will do almost all the hard work for you!

### 🪟 If you have a Windows computer:
1. Open the folder where you saved this project.
2. Open the **`Setup_Assistant`** folder.
3. Double-click the **`INSTALL_WINDOWS.bat`** file.
4. Click "YES" when Windows asks for permission, and wait for the magic to happen!
*(A blue box will open and start downloading everything you need. When it says "Installation Complete!", you can close it.)*

### 🍎 If you have an Apple computer (Mac) or Linux:
1. Keep holding `Command` (or `Ctrl`+`Alt`+`T` on Linux) and tap the Spacebar. Type the word "Terminal" and press Enter. A black box will pop up!
2. Drag the **`Setup_Assistant`** folder into the Terminal box and press Enter.
3. Type this magic spell and press Enter:
   ```bash
   chmod +x install_mac_linux.sh
   ./install_mac_linux.sh
   ```
4. It might ask for your computer password. Type it in (you won't see the letters as you type) and press Enter!

---

## 🎁 Step 2: You're almost done!

---

## 🔑 Step 3: The Secret Password Key

Our website needs a filing cabinet to remember things. We need to give it a secret key! Ask an adult for help here.

1. Tell the computer to make a secret settings file:
   - **For Mac/Linux, type:** `cp .env.example .env`
   - **For Windows, type:** `copy .env.example .env`
2. This creates a hidden file called `.env`. (Adults: you can open this and change `DATABASE_URL` if you want to use a real database!).

---

## 🏗️ Step 4: Putting the Blocks Together

If you used the Setup Assistant, your blocks are already put together! You can skip to **Step 5**!

If you want to do it manually, here is how:
1. Type this to download any missing pieces:
   ```bash
   npm install
   ```
2. Type this to build our database cabinet:
   ```bash
   npm run db:push
   ```

*(Wait a minute or two... the computer is thinking hard! ⏱️)*

---

## � Step 4.5: Loading a Saved Game! (Optional)

*Wait! Did your teacher or friend already build a cabinet and give you the saved game file?*

If they gave you a backup file (ending in `.sql` or `.json`):
1. Put the file inside the folder named `database/backups`.
2. Type this spell to load the saved game:
   ```bash
   npm run db:restore
   ```
3. *Poof!* All the old projects and friends are back!

---

## 🎉 Step 5: Turning on the Power! It's Alive!

Are you ready to see your creation? Let's turn the power on!

1. Type this to start the engine:
   ```bash
   npm run dev
   ```
2. Open your web browser (like Chrome, Edge, or Safari).
3. Type this into the very top bar where web addresses go, and hit Enter:
   👉 **`http://localhost:3000`**

**WOW! YOU DID IT!** 🌟 
You are amazing! You just built a real website all by yourself! Give yourself a high-five! ✋

---

### � Bonus: Want to make it super fast? (Production)

When you are done playing and want to make the website super fast:
1. Go to your black Terminal box and press `Ctrl + C` to turn the engine off.
2. Type this to pack your website tightly into a race-car box:
   ```bash
   npm run build
   ```
3. Type this to start the race-car engine:
   ```bash
   npm run start
   ```

You are officially a coding superstar! 🌟
