📁 File Organizer CLI
A powerful command-line tool to automatically organize your files with customizable rules.
Organize your Downloads, Documents, or any folder with ease!

🌍 Cross-platform support (Windows, macOS, Linux)

📦 Installation
Prerequisites

Node.js (v14 or higher)
npm or yarn

Steps

Clone this repository:
```bash
git clone https://github.com/your-username/file-organizer-cli.git
cd file-organizer-cli
```
Install dependencies:
```bash
npm install
```

Make the CLI file executable:
```bash
chmod +x index.js
```
Link the CLI globally so you can run file-organizer from anywhere:
```bash
npm link
```
Now in your root directory run these commands 

##Core Commands:
```bash
file-organizer organize -d ~/Downloads    # Organize files in specific directory
file-organizer downloads                  # Quick organize Downloads folder
file-organizer watch -d ~/Downloads       # Auto-organize new files as they appear
```
##Rule Management:
```bash
file-organizer rules                      # List all organization rules
file-organizer add-rule                   # Add new rule (interactive)
file-organizer remove-rule <id>           # Delete rule by ID
file-organizer toggle-rule <id>           # Enable/disable rule by ID
```
##Utility:
```bash
file-organizer config                     # Show config file location
file-organizer --help                     # Show all commands
file-organizer <command> --help           # Help for specific command
```

