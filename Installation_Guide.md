# 🚀 The Ultimate Guide to Running "Integral Project Hub"

Hey there, future builder! 👋 Imagine you just got a brand new LEGO set, but instead of plastic bricks, you are building a real website! 

This guide will show you exactly how to take the instructions (code) and turn it into a working website on your own computer. It is super easy—just follow the steps for your computer type (Windows, Mac, or Linux) like a recipe!

---

## 🛠️ Step 1: Getting Your Tools Ready

Before we can build our house, we need a hammer and some nails. For coding, our "tools" are **Node.js** (which helps the computer understand our code) and **Git** (which helps us download the code).

### 🍎 For Mac Users:
1. Open up your **Terminal** (Press `Command + Space`, type "Terminal", and hit Enter).
2. We need a helper called Homebrew. Copy this magic spell, paste it in the Terminal, and press Enter:
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
3. Once that is done, let's install our tools! Type this and press Enter:
   ```bash
   brew install node git
   ```

### 🪟 For Windows Users:
1. Go to [nodejs.org](https://nodejs.org) in your web browser, download the "LTS" version, and install it (just keep clicking 'Next'!).
2. Go to [gitforwindows.org](https://gitforwindows.org/), download it, and install it.
3. Open a program called **Command Prompt** (Click the Start button, type `cmd`, and press Enter).

### 🐧 For Linux (Ubuntu/Debian) Users:
1. Open your **Terminal** (Press `Ctrl + Alt + T`).
2. Type these commands one by one and press Enter after each:
   ```bash
   sudo apt update
   sudo apt install nodejs npm git
   ```

---

## 📦 Step 2: Getting the LEGO Box (Downloading the Code)

Now that we have our tools, let's download the website code!

1. In your Terminal or Command Prompt, type this exact line and press Enter:
   ```bash
   git clone https://github.com/SwetabhSingh17/APMS.git IntegralProjectHub
   ```
2. Now, let's walk *inside* the folder we just downloaded:
   ```bash
   cd IntegralProjectHub
   ```

---

## 🔑 Step 3: Giving it the Secret Keys

Your website needs to talk to a "Database" (which is like a giant filing cabinet where it saves user names and projects). It needs a secret key to open the cabinet!

1. Find the file named `.env.example` in the folder.
2. Make a copy of it and name the copy **`.env`** (with a dot at the start!).
   - **On Mac/Linux, type:** `cp .env.example .env`
   - **On Windows, type:** `copy .env.example .env`
3. Look inside the new `.env` file using any text editor (like Notepad or TextEdit) and make sure the `DATABASE_URL` line matches your database details. *(Ask an adult or refer to PostgreSQL setups if you are setting up your own filing cabinet!)*

---

## 🏗️ Step 4: Connecting the Pieces!

This is where the magic happens! We are going to tell the computer to gather all the missing pieces and put the website together.

1. Tell the computer to download all the extra parts it needs:
   ```bash
   npm install
   ```
2. Tell the computer to build the filing cabinet (the database):
   ```bash
   npm run db:push
   ```

*(Wait a minute or two while the computer builds things... ⏱️)*

---

## 🎉 Step 5: Turning on the Power! (Running the Server)

Are you ready to see what you built?

1. Type this final command:
   ```bash
   npm run dev
   ```
2. Open your web browser (like Chrome or Safari).
3. Type this into the top address bar and press Enter:
   👉 **`http://localhost:3000`**

**WOW! YOU DID IT!** 🌟 
You are now running a real, live web server on your computer!

---

### 🚢 Bonus: Releasing it to the World (Production)

If you want to pack up your website and put it on the actual internet for your friends to see, you do a "Production Build".

1. Stop the server you started in Step 5 (Press `Ctrl + C` in the Terminal).
2. Type this to pack everything tightly into a small box:
   ```bash
   npm run build
   ```
3. Type this to run the super-fast, packed version:
   ```bash
   npm run start
   ```

You are a coding superstar! 🚀
