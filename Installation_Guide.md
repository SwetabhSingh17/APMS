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

## 🎒 Step 1: Getting Our Tools Ready! (Installation)

We have a special "Setup Assistant" that will do almost all the hard work for you! Choose your computer type below:

### 🪟 Windows Installation

**Option A: The Automated Setup Assistant (Easiest!)**
1. Open the folder where you saved this project.
2. Open the **`Setup_Assistant`** folder.
3. Double-click the **`INSTALL_WINDOWS.bat`** file.
4. Click "YES" when Windows asks for permission, and wait for the magic to happen!
*(A blue box will open and start downloading everything you need. When it says "Installation Complete!", you can close it.)*

**Option B: Manual Step-by-Step (For Windows Server, or if the .bat file gets blocked)**
If you are on a Windows Server (which lacks the Microsoft Store for automated installs), or if your Antivirus blocks the `.bat` file, you can build it manually:
1. Go to **nodejs.org** and install Node.js.
2. Go to **postgresql.org** and install PostgreSQL (version 15 or 16). *(⚠️ IMPORTANT: When it asks for a password during setup, set it to `root123`)*.
3. Open the **Command Prompt** (type `cmd` in your Windows search bar, right-click and "Run as Administrator").
4. Navigate to your project folder (e.g. your Downloads folder):
   ```cmd
   cd Downloads\APMS
   ```
5. Install the required tools:
   ```cmd
   npm install
   ```
6. Create your secret settings file:
   ```cmd
   copy .env.example .env
   ```
7. Create the empty database by running this command exactly as written *(Type `root123` if asked for a password. If you installed PostgreSQL 15, change `16` to `15`)*:
   ```cmd
   "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE DATABASE integral_project_hub;"
   ```
8. Build the tables inside the database:
   ```cmd
   npm run db:push
   ```
   *(⚠️ If this step shows an error in red, open the `.env` file and make sure the `DB_PASSWORD` matches what you set in step 2!)*
9. Skip to **Step 2**!

---

### 🍎 Mac Installation

**Option A: The Automated Setup Assistant**
1. Press `Command` + `Space`, type "Terminal", and press Enter.
2. Open Finder, find the **`Setup_Assistant`** folder, and drag it into the Terminal window. Press Enter.
3. Type this magic spell and press Enter:
   ```bash
   chmod +x install_mac_linux.sh
   ./install_mac_linux.sh
   ```
4. It might ask for your computer password. Type it in (you won't see the letters) and press Enter!

**Option B: Manual Step-by-Step (If the .sh file doesn't run)**
1. Go to **nodejs.org** and install Node.js.
2. Download Postgres app from **postgresapp.com** and install it.
3. Open your Terminal and navigate to the project folder:
   ```bash
   cd path/to/APMS
   ```
4. Install the required tools:
   ```bash
   npm install
   ```
5. Create your secret settings file:
   ```bash
   cp .env.example .env
   ```
6. Build the database:
   ```bash
   npm run db:push
   ```
7. Skip to **Step 2**!

---

### 🐧 Linux Installation

**Option A: The Automated Setup Assistant**
1. Press `Ctrl`+`Alt`+`T` to open your Terminal.
2. Type `cd path/to/APMS/Setup_Assistant` (replace with your actual folder path) and press Enter.
3. Type this magic spell and press Enter:
   ```bash
   chmod +x install_mac_linux.sh
   ./install_mac_linux.sh
   ```
4. Type your sudo password and press Enter!

**Option B: Manual Step-by-Step**
1. Install Node.js:
   ```bash
   sudo apt install nodejs npm
   ```
2. Install PostgreSQL:
   ```bash
   sudo apt install postgresql
   ```
3. Open your Terminal and navigate to the project folder.
4. Install the required tools:
   ```bash
   npm install
   ```
5. Create your secret settings file:
   ```bash
   cp .env.example .env
   ```
6. Build the database:
   ```bash
   npm run db:push
   ```
7. Skip to **Step 2**!

---

## 💾 Step 2: Loading a Saved Game! (Optional)

*Wait! Did your teacher or friend already build a cabinet and give you the saved game file?*

If they gave you a backup file (ending in `.sql`):
1. Put the file inside the folder named `database/backups`.
2. Type this spell to load the saved game:
   ```bash
   npm run db:restore
   ```
3. *Poof!* All the old projects and friends are back! *(Note: The Setup Assistant does this automatically if the file is there!)*

---

## 🎉 Step 3: Turning on the Power! It's Alive!

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

### 🏎️ Bonus: Want to make it super fast? (Production)

When you are done playing and want to make the website super fast:

**For Windows Users:**
Just double-click the **`start_server.bat`** file in your APMS folder! It will automatically build and start your website in production mode.

**For Mac/Linux Users (or manual Windows):**
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
