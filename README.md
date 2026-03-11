# Clipboard Vault 📋

**Free, unlimited clipboard history for macOS + Raycast.**

No subscriptions. No Raycast Pro. No cloud. Just a Swift daemon that watches your clipboard and a Raycast extension to search and paste.

## What is this?

Raycast's built-in clipboard history is limited unless you pay $10/month for Raycast Pro. This project gives you **unlimited clipboard history** for free:

1. **Swift Daemon** — Runs in the background, monitors `NSPasteboard`, saves everything to a local SQLite database
2. **Raycast Extension** — Searches the database and lets you paste from history, just like the native clipboard history

## Features

- ♾️ **Unlimited history** — No cap on entries, ever
- 🔍 **Full-text search** — Find anything you've ever copied
- 📌 **Pin entries** — Keep important items at the top
- 🏷️ **Auto-detect content type** — URLs, emails, file paths, plain text
- 📱 **Source app tracking** — Know where you copied from
- 🔒 **Password manager exclusion** — Automatically skips 1Password, Bitwarden, Keychain Access
- ⚡ **Fast** — SQLite is fast. No network calls. No cloud.
- 🖥️ **Fully local** — Your data never leaves your machine

## Setup

### 1. Build the daemon

```bash
cd daemon
swiftc ClipboardVault.swift -o clipboard-vault -framework Cocoa -framework Foundation
```

### 2. Install the daemon

```bash
# Copy the binary
sudo cp clipboard-vault /usr/local/bin/

# Install the LaunchAgent (auto-start on login)
cp com.kandotrun.clipboard-vault.plist ~/Library/LaunchAgents/

# Start the daemon
launchctl load ~/Library/LaunchAgents/com.kandotrun.clipboard-vault.plist
```

### 3. Install the Raycast extension

```bash
cd raycast-extension
npm install
npm run build
```

Then in Raycast:
1. Open Raycast → search "Import Extension"
2. Select the `raycast-extension` folder
3. Done!

### 4. Set up the hotkey (optional)

Go to **Raycast Settings → Extensions → Clipboard Vault → Search Clipboard Vault** and assign `⌘⇧C` (or whatever you prefer).

## Usage

| Action | Shortcut |
|--------|----------|
| Paste to active app | `Enter` |
| Copy to clipboard | `⌘ Enter` |
| Pin / Unpin | `⌘⇧P` |
| Delete entry | `⌘ Delete` |

## Configuration

The daemon creates a config file at `~/.clipboard-vault/config.json` on first run:

```json
{
  "dbPath": "~/.clipboard-vault/clipboard.db",
  "excludedApps": ["Keychain Access", "1Password", "Bitwarden"]
}
```

Add any app names to `excludedApps` to prevent their clipboard data from being saved.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  NSPasteboard   │────▶│  Swift Daemon     │────▶│  SQLite DB      │
│  (system)       │     │  (0.5s polling)   │     │  (~/.clipboard- │
│                 │     │                   │     │   vault/)       │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                                                          │ reads
                                                          ▼
                                                 ┌─────────────────┐
                                                 │  Raycast Ext    │
                                                 │  (better-sqlite3│
                                                 │   + React)      │
                                                 └─────────────────┘
```

## Uninstall

```bash
# Stop and remove the daemon
launchctl unload ~/Library/LaunchAgents/com.kandotrun.clipboard-vault.plist
rm ~/Library/LaunchAgents/com.kandotrun.clipboard-vault.plist
sudo rm /usr/local/bin/clipboard-vault

# Remove data
rm -rf ~/.clipboard-vault

# Remove Raycast extension via Raycast preferences
```

## Requirements

- macOS 12+
- Swift (included with Xcode or Command Line Tools)
- Node.js 18+ (for building the Raycast extension)
- [Raycast](https://raycast.com/) (free tier is fine!)

## License

MIT
