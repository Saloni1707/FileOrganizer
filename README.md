<h1>📁 File Organizer CLI ~</h1>
A powerful command-line tool to automatically organize your files with customizable rules.
Organize your Downloads, Documents, or any folder with ease!

~ Cross-platform support (Windows, macOS, Linux)

<h2>~ Installation </h2>
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
<h3>Now in your root directory run these commands </h3>

<h4>Core Commands:</h4>
```bash
file-organizer organize -d ~/Downloads    # Organize files in specific directory
file-organizer downloads                  # Quick organize Downloads folder
file-organizer watch -d ~/Downloads       # Auto-organize new files as they appear
```
<h4>Rule Management:</h4>
```bash
file-organizer rules                      # List all organization rules
file-organizer add-rule                   # Add new rule (interactive)
file-organizer remove-rule <id>           # Delete rule by ID
file-organizer toggle-rule <id>           # Enable/disable rule by ID
```
<h4>Utility:</h4>
```bash
file-organizer config                     # Show config file location
file-organizer --help                     # Show all commands
file-organizer <command> --help           # Help for specific command
```

