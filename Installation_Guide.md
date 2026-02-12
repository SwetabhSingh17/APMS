# 🎓 Integral Project Hub — Installation Guide

> **This guide is written so that even a complete beginner can follow it.** Every single step is explained in detail. Don't worry if you've never done anything like this before — just follow along, one step at a time!

---

## 📖 Table of Contents

- [What Are We Installing?](#-what-are-we-installing)
- [Step 1: Install Node.js](#-step-1-install-nodejs-the-engine)
- [Step 2: Install PostgreSQL](#-step-2-install-postgresql-the-database)
- [Step 3: Get the Project Code](#-step-3-get-the-project-code)
- [Step 4: Install Project Dependencies](#-step-4-install-project-dependencies)
- [Step 5: Configure the Environment](#-step-5-configure-the-environment)
- [Step 6: Set Up the Database](#-step-6-set-up-the-database)
- [Step 7: Start the Application](#-step-7-start-the-application)
- [Running It Again Later](#-running-it-again-later)
- [Stopping the Application](#-stopping-the-application)
- [Troubleshooting](#-troubleshooting)
- [Quick-Start Setup Assistants](#-quick-start-setup-assistants)

---

## 🧩 What Are We Installing?

Before we begin, let's understand the three things we need:

| What | Why | Think of it as... |
|------|-----|-------------------|
| **Node.js** | Runs the application code | The **engine** of a car — it makes everything go |
| **PostgreSQL** | Stores all the data (users, projects, groups) | A **filing cabinet** that remembers everything |
| **npm packages** | Extra tools the app needs (already listed in the code) | **Accessories** like mirrors and wipers for the car |

Once these three things are installed, the website will run on your own computer!

---

## 🟢 Step 1: Install Node.js (The Engine)

Node.js is what makes our application run. We need version **18 or higher**.

### 🪟 Windows

1. Open your web browser (Chrome, Edge, Firefox — any one).
2. Go to: **https://nodejs.org/**
3. You'll see a big green button that says **"LTS"** (Long Term Support). Click it to download.
4. A file called something like `node-v22.x.x-x64.msi` will download.
5. **Double-click** that downloaded file.
6. An installer wizard will open:
   - Click **"Next"**
   - Accept the license → Click **"Next"**
   - Keep the default install location → Click **"Next"**
   - Keep all default features → Click **"Next"**
   - ✅ Check the box that says **"Automatically install the necessary tools"** if you see it
   - Click **"Install"**
   - Click **"Yes"** if Windows asks for permission
7. Click **"Finish"** when it's done.

**✅ Verify it worked:**
- Press `Win + R`, type `cmd`, press Enter (this opens Command Prompt)
- Type: `node --version` and press Enter
- You should see something like `v22.x.x` — that means it worked! 🎉

### 🍎 macOS

**Option A — Download from website (easiest):**
1. Open Safari (or any browser).
2. Go to: **https://nodejs.org/**
3. Click the big green **"LTS"** button.
4. A `.pkg` file will download.
5. **Double-click** the downloaded file.
6. Follow the installer — click **"Continue"** → **"Agree"** → **"Install"**.
7. Enter your Mac password when asked (the one you use to log in).
8. Click **"Close"** when finished.

**Option B — Using Homebrew (if you have it):**
```bash
brew install node
```

**✅ Verify it worked:**
- Press `Cmd + Space`, type `Terminal`, press Enter
- Type: `node --version` and press Enter
- You should see something like `v22.x.x` 🎉

### 🐧 Linux (Ubuntu/Debian)

1. Press `Ctrl + Alt + T` to open Terminal.
2. Run these commands one by one (copy-paste each line, press Enter after each):

```bash
sudo apt update
sudo apt install -y curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

> 💡 When it asks for your password, type it and press Enter. **You won't see the password as you type** — that's normal! It's a security feature.

### 🐧 Linux (Fedora/RHEL)

```bash
sudo dnf install -y nodejs npm
```

**✅ Verify it worked:**
```bash
node --version
```
You should see `v22.x.x` or similar 🎉

---

## 🐘 Step 2: Install PostgreSQL (The Database)

PostgreSQL (often called "Postgres") is the database — it stores all the users, projects, groups, and grades.

### 🪟 Windows

1. Go to: **https://www.postgresql.org/download/windows/**
2. Click **"Download the installer"** (from EDB).
3. Choose the latest version (e.g., PostgreSQL 16) and click **Download**.
4. **Double-click** the downloaded file.
5. Installer wizard:
   - Click **"Next"**
   - Keep the default install location → **"Next"**
   - Keep all components selected → **"Next"**
   - Keep the default data directory → **"Next"**
   - **⚠️ IMPORTANT: Set a password for the database superuser.** Use something simple you'll remember, like `postgres123`. **Write this password down!** You'll need it later.
   - Keep the default port **5432** → **"Next"**
   - Keep the default locale → **"Next"**
   - Click **"Next"** → **"Install"**
   - Wait for it to finish → Click **"Finish"**
   - Uncheck "Launch Stack Builder" → **"Finish"**

**✅ Verify it worked:**
- Press `Win + R`, type `cmd`, press Enter
- Type: `psql --version` and press Enter
- You should see something like `psql (PostgreSQL) 16.x`

> 💡 If `psql` is not found, you need to add PostgreSQL to your PATH:
> 1. Search for "Environment Variables" in the Start menu
> 2. Click "Edit the system environment variables"
> 3. Click "Environment Variables"
> 4. Under "System variables", find "Path", click "Edit"
> 5. Click "New" and add: `C:\Program Files\PostgreSQL\16\bin`
> 6. Click OK on all windows, then restart Command Prompt

### 🍎 macOS

**Option A — Using Homebrew (recommended):**

If you don't have Homebrew, install it first by opening Terminal and pasting:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Then install PostgreSQL:
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Option B — Postgres.app (visual method):**
1. Go to: **https://postgresapp.com/**
2. Download and drag to your Applications folder.
3. Open it and click **"Initialize"**.

**✅ Verify it worked:**
```bash
psql --version
```

### 🐧 Linux (Ubuntu/Debian)

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 🐧 Linux (Fedora/RHEL)

```bash
sudo dnf install -y postgresql-server postgresql-contrib
sudo postgresql-setup --initdb
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**✅ Verify it worked:**
```bash
psql --version
```

---

### 🗄️ Create the Database

Now we need to create a database for our application. This is like creating a new empty filing cabinet.

**All Operating Systems:**

Open your terminal/command prompt and run:

```bash
# Switch to the postgres user and open the PostgreSQL prompt
# On Windows, just open "SQL Shell (psql)" from the Start menu instead

# On Mac/Linux:
sudo -u postgres psql
```

> 💡 **Windows users:** Open the **SQL Shell (psql)** app from your Start menu. It will ask you for Server (press Enter), Database (press Enter), Port (press Enter), Username (press Enter), and then your password (type the password you set during installation).

Now type these commands one by one in the `postgres=#` prompt:

```sql
CREATE DATABASE integral_project_hub;
```

If it says `CREATE DATABASE`, it worked! Now type:

```sql
\q
```

This exits the database prompt. ✅

> 💡 **Windows users:** If you set a password during installation, remember it. **Mac/Linux users:** The default setup usually doesn't require a password for local connections.

---

## 📥 Step 3: Get the Project Code

### If You Downloaded a ZIP File

1. Find the ZIP file in your Downloads folder.
2. **Right-click** it → **"Extract All"** (Windows) or **double-click** it (Mac/Linux).
3. You now have a folder called `IntegralProjectHub`.
4. Remember where this folder is — you'll need the path!

### If You're Using Git

```bash
git clone https://github.com/SwetabhSingh17/APMS.git
cd IntegralProjectHub
```



---

## 📦 Step 4: Install Project Dependencies

Now we need to install all the tools and libraries the project needs. Think of this as getting all the spare parts your car engine needs.

### All Operating Systems

1. **Open your terminal / command prompt.**

2. **Navigate to the project folder:**

   **🪟 Windows (Command Prompt or PowerShell):**
   ```cmd
   cd C:\path\to\IntegralProjectHub
   ```
   > 💡 **Easy trick:** Open the `IntegralProjectHub` folder in File Explorer, click in the address bar at the top, type `cmd`, and press Enter. This opens Command Prompt already in the right folder!

   **🍎 macOS (Terminal):**
   ```bash
   cd /path/to/IntegralProjectHub
   ```
   > 💡 **Easy trick:** Type `cd ` (with a space after it), then drag the `IntegralProjectHub` folder from Finder into the Terminal window, then press Enter.

   **🐧 Linux (Terminal):**
   ```bash
   cd /path/to/IntegralProjectHub
   ```

3. **Install everything:**
   ```bash
   npm install
   ```

   ⏳ This will take **2–5 minutes**. You'll see a lot of text scrolling by — that's normal! It's downloading all the libraries the project needs.

   When you see something like `added 500 packages in 30s`, it's done! ✅

---

## 🔧 Step 5: Configure the Environment

The application needs to know how to connect to your database. We tell it this through a special file called `.env`.

### All Operating Systems

1. In the `IntegralProjectHub` folder, find the file called **`.env.example`**.

2. **Make a copy of it** and name the copy **`.env`**:

   **🪟 Windows (Command Prompt):**
   ```cmd
   copy .env.example .env
   ```

   **🍎 macOS / 🐧 Linux (Terminal):**
   ```bash
   cp .env.example .env
   ```

3. **Open the `.env` file** in any text editor (Notepad, TextEdit, VS Code, nano — anything works):

   **🪟 Windows:**
   ```cmd
   notepad .env
   ```

   **🍎 macOS:**
   ```bash
   open -e .env
   ```

   **🐧 Linux:**
   ```bash
   nano .env
   ```

4. **Edit the values** to match your setup:

   ```env
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=integral_project_hub
   DB_USER=postgres
   DB_PASSWORD=YOUR_POSTGRES_PASSWORD_HERE

   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # Session Configuration
   SESSION_SECRET=pick-any-long-random-string-here-like-this-one
   ```

   > ⚠️ **Replace `YOUR_POSTGRES_PASSWORD_HERE`** with the password you set when installing PostgreSQL.
   >
   > - **Windows users:** This is the password you typed during the PostgreSQL installer.
   > - **Mac users (Homebrew):** If you didn't set a password, leave it empty: `DB_PASSWORD=`
   > - **Linux users:** If you didn't set a password, leave it empty: `DB_PASSWORD=`

5. **Save the file** and close the editor.
   - Notepad: `Ctrl + S` then close
   - TextEdit: `Cmd + S` then close
   - nano: `Ctrl + O`, Enter, then `Ctrl + X`

---

## 🗃️ Step 6: Set Up the Database

Now we need to create all the tables inside the database. Think of this as putting shelves and labels inside the empty filing cabinet.

### All Operating Systems

Make sure you're in the `IntegralProjectHub` folder in your terminal, then run:

```bash
npm run db:push
```

You should see output ending with something like:

```
Changes applied successfully
```

That means all the tables have been created! ✅

> 💡 If you see an error about "connection refused", make sure PostgreSQL is running:
> - **Windows:** Open "Services" (search in Start menu), find "postgresql", make sure it says "Running"
> - **Mac (Homebrew):** Run `brew services start postgresql@16`
> - **Linux:** Run `sudo systemctl start postgresql`

---

## 🚀 Step 7: Start the Application!

This is the exciting part! 🎉

### All Operating Systems

In your terminal (still in the `IntegralProjectHub` folder), type:

```bash
npm run dev
```

You'll see output like:

```
Server running on http://0.0.0.0:3000
Local: http://localhost:3000
```

**Now open your web browser** (Chrome, Firefox, Safari, Edge — any one) and go to:

### 👉 **http://localhost:3000**

**You should see the Integral Project Hub login page!** 🎉🎉🎉

---

## 🔄 Running It Again Later

Once everything is installed, you **don't need to repeat Steps 1–6**. Just do this:

1. Open your terminal / command prompt
2. Navigate to the project folder:
   ```bash
   cd /path/to/IntegralProjectHub
   ```
3. Start the app:
   ```bash
   npm run dev
   ```
4. Open **http://localhost:3000** in your browser

That's it! Two commands and you're up and running. 🚀

---

## 🛑 Stopping the Application

When you're done using the app:

1. Go back to the terminal window where the app is running
2. Press **`Ctrl + C`** on your keyboard (hold the Ctrl key and tap C)
3. The server will stop and the website will no longer be accessible

> 💡 This is completely safe. Your data is saved in the database. Next time you run `npm run dev`, everything will be right where you left it.

---

## 🏗️ Building for Production

If you want to run the app in production mode (faster, optimized):

```bash
# Build the project
npm run build

# Start the production server
npm start
```

---

## 🆘 Troubleshooting

### ❌ "node: command not found" or "'node' is not recognized"

**What it means:** Node.js isn't installed, or your system can't find it.

**Fix:**
- Make sure you completed [Step 1](#-step-1-install-nodejs-the-engine)
- **Windows:** Close and reopen Command Prompt after installing Node.js
- **Mac/Linux:** Close and reopen Terminal, or run `source ~/.bashrc`

---

### ❌ "psql: command not found"

**What it means:** PostgreSQL isn't installed, or your system can't find it.

**Fix:**
- Make sure you completed [Step 2](#-step-2-install-postgresql-the-database)
- **Windows:** Add PostgreSQL's `bin` folder to your PATH (see the tip in Step 2)
- **Mac (Homebrew):** Run `brew link postgresql@16`

---

### ❌ "ECONNREFUSED" or "Connection refused" when starting the app

**What it means:** The database server isn't running.

**Fix:**
- **Windows:** Open Services app → Find "postgresql" → Click "Start"
- **Mac:** Run `brew services start postgresql@16`
- **Linux:** Run `sudo systemctl start postgresql`

---

### ❌ "password authentication failed"

**What it means:** The password in your `.env` file doesn't match your PostgreSQL password.

**Fix:**
1. Open the `.env` file
2. Check that `DB_PASSWORD=` has the correct password
3. Save and try again

---

### ❌ "database 'integral_project_hub' does not exist"

**What it means:** You haven't created the database yet.

**Fix:** Go back to the [Create the Database](#%EF%B8%8F-create-the-database) section and create it.

---

### ❌ "Port 3000 is already in use"

**What it means:** Another application is using port 3000.

**Fix:**
- Close any other development servers you have running
- Or change the port in your `.env` file: `PORT=3001` (then visit http://localhost:3001 instead)

---

### ❌ Installation is very slow or hangs

**Fix:**
1. Check your internet connection
2. Try running `npm install` again
3. If still stuck, try clearing the cache first:
   ```bash
   npm cache clean --force
   npm install
   ```

---

## ⚡ Quick-Start Setup Assistants

If you prefer a one-click installation, check the **`Setup_Assistant/`** folder:

| Your System | File to Run | How to Run |
|-------------|-------------|------------|
| **Windows** | `INSTALL_WINDOWS.bat` | Double-click the file |
| **Windows** (advanced) | `install_windows.ps1` | Right-click → "Run with PowerShell" |
| **macOS / Linux** | `install_mac_linux.sh` | Open Terminal → `chmod +x install_mac_linux.sh` → `./install_mac_linux.sh` |

These scripts attempt to install Node.js, PostgreSQL, and set everything up automatically. See `Setup_Assistant/HOW_TO_RUN.txt` for detailed instructions on using them.

---

<p align="center">
  <b>🎉 Congratulations! You've successfully set up Integral Project Hub! 🎉</b>
  <br/>
  <br/>
  Your app is live at: <b>http://localhost:3000</b>
</p>
