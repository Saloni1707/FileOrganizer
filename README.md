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

##Core Commands:
```bash
file-organizer organize -d ~/Downloads    
file-organizer downloads                  
file-organizer watch -d ~/Downloads      
```
##Rule Management:
```bash
file-organizer rules                     
file-organizer add-rule                  
file-organizer remove-rule <id>          
file-organizer toggle-rule <id>          
```
##Utility:
```bash
file-organizer config                     
file-organizer --help                     
file-organizer <command> --help          
```

