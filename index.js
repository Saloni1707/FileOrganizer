#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto'); //here we calc file hash to detect duplicates
const os = require('os'); //get the systems info like home directory
const {program} = require('commander'); 
const inquirer = require('inquirer'); 
const chalk = require('chalk');   
const chokidar = require('chokidar');
const {oraPromise} = require('ora'); 
const Table = require('cli-table3'); //cute tables in terminal


//here we organise the files in the directory

class FileOrganizer {
    constructor() {
        this.configDir = path.join(os.homedir(), '.file-organizer-cli');
        this.configFile = path.join(this.configDir, 'config.json');
        this.rules = []; 
        this.duplicateHashes = new Map(); //here we initialize a map to store duplicate file hashes
        this.processedFiles = []; 
        this.watchers = new Map(); 

        this.init();
    }

    async init() {
        if(this.initialized) return; 
        try{
            await fs.mkdir(this.configDir, {recursive:true});
            await this.loadConfig();
        }catch(error){
            console.error(chalk.red('Error initializing File Organizer:'),error.message);
        }
    }

    async ensureInitialized() {
        if(!this.initialized){
            await this.init();
        }
    }

    async loadConfig() {
        try {
            const data = await fs.readFile(this.configFile, 'utf8');
            const config = JSON.parse(data);
            this.rules = config.rules || [];
            this.duplicateHashes = new Map(Object.entries(config.duplicateHashes || {}));
        }catch(err){
            console.log(chalk.yellow('No config file found, starting with empty rules and duplicates.'));
            await this.createDefaultConfig();
        }
    }

    async saveConfig() {
        const config = {
            rules: this.rules,
            duplicateHashes: Object.fromEntries(this.duplicateHashes)
        };
        await fs.writeFile(this.configFile,JSON.stringify(config, null, 2));
    }

    async createDefaultConfig() {
        this.rules = [
        {
            id: 'pdf-docs',
            name: 'PDF Documents',
            conditions: {extensions: '.pdf'},
            destination: 'Documents/PDFs',
            action: 'move',
            enabled: true
        },{
            id: 'images',
            name: 'Images',
            conditions: {extensions: '.jpg,.jpeg,.png,.gif,.bmp,.webp'},
            destination: 'Pictures/Downloads',
            action:'move',
            enabled: true
        },{
            id:'videos',
            name:'Videos',
            conditions: {extensions: '.mp4,.avi,.mkv,.mov,.wmv'}, 
            destination: 'Videos/Downloads',
            action: 'move',
            enabled: true 
        },
        {
            id:'audio',
            name: 'Audio Files',
            conditions: {extensions: '.mp3,.wav,.flac,.aac,.ogg'},
            destination: 'Music/Downloads',
            action: 'move',
            enabled: true
        },{
            id:'documents',
            name:'Documents',
            conditions: {extensions: '.doc,.docx,.txt,.rtf,.odt'}, // Fixed: was 'extension'
            destination:'Documents/Text',
            action:'move',
            enabled:true
        },{
            id:'spreadsheets',
            name:'Spreadsheets',
            conditions:{extensions: '.xls,.xlsx,.csv,.ods'}, // Fixed: was 'extension'
            destination: 'Documents/Spreadsheets',
            action:'move',
            enabled:true
        }
        ];
        await this.saveConfig();
    }

    async getFileStats(filePath){
        try{
            const stats = await fs.stat(filePath);
            return{
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime,
                isFile: stats.isFile(),
                isDirectory: stats.isDirectory()
            };
        }catch(err){
            return null;
        }
    }

    async getFileHash(filePath) {
        try {
            const fileBuffer = await fs.readFile(filePath);
            const hashSum = crypto.createHash('sha256');
            hashSum.update(fileBuffer);
            return hashSum.digest('hex');
        } catch (error) {
            return null;
        }
    }

    matchesConditions(filePath, fileStats, conditions){
        const fileName = path.basename(filePath);
        const extension = path.extname(filePath).toLowerCase();

        for(const[key, value] of Object.entries(conditions)){ 
            switch(key){
                case 'extensions': 
                    const extensions = value.split(',').map(ext => ext.trim().toLowerCase());
                    if(!extensions.includes(extension)) return false; 
                    break;
                case 'nameContains':
                    if(!fileName.toLowerCase().includes(value.toLowerCase())) return false;
                    break;
                case 'sizeGreaterThan':
                    if(fileStats.size <= parseInt(value)) return false;
                    break;
                case 'sizeLessThan':
                    if(fileStats.size >= parseInt(value)) return false;
                    break;
                case 'olderThanDays':
                    const daysAgo = new Date(Date.now() - (parseInt(value) * 24 * 60 * 60 * 1000));
                    if(fileStats.modified > daysAgo) return false;
                    break;
            }
        }
        return true;
    }

    async isDuplicate(filePath){
        const hash = await this.getFileHash(filePath); //this func calculates a unique hash
        if(!hash) return false; //if the hash couldn't be generated means the file doesn't exist
        if(this.duplicateHashes.has(hash)){
            const existingFile = this.duplicateHashes.get(hash);
            try{
                await fs.access(existingFile);
                return existingFile;
            }catch(err){
                this.duplicateHashes.set(hash,filePath);
                return false;
            }
        }
        this.duplicateHashes.set(hash,filePath);
        return false;
    }

    async ensureDirectoryExists(dirPath){ 
        try{
            await fs.mkdir(dirPath,{ recursive: true});
        }catch(err){
            console.error(chalk.red(`Error creating directory ${dirPath}:`),err.message);
        }
    }

    async processFile(filePath){
        try{
            const fileStats = await this.getFileStats(filePath);
            if(!fileStats || !fileStats.isFile) return null;
            //chk here for duplicates thike
            const duplicateOf = await this.isDuplicate(filePath);
            if(duplicateOf){
                await this.handleDuplicate(filePath, duplicateOf);
                return {type: 'duplicate',original: duplicateOf};
            }
            //Find matching rule
            const matchingRule = this.rules.find(rule => 
                rule.enabled && this.matchesConditions(filePath,fileStats,rule.conditions)
            );

            if(matchingRule){
                const result = await this.executeRule(filePath,matchingRule);
                return {type: 'organized',rule: matchingRule,result};
            }
            return null;
        }catch(error){
            console.error(chalk.red(`Error processing file ${filePath}:`),error.message);
            return null;
        }
    }

    async handleDuplicate(filePath,originalPath){ 
        const fileName = path.basename(filePath);
        const duplicatesDir = path.join(path.dirname(originalPath),'Duplicates');
        await this.ensureDirectoryExists(duplicatesDir);
        
        const duplicatePath = path.join(duplicatesDir,fileName);
        await fs.rename(filePath,duplicatePath);
        console.log(chalk.yellow(`Moved Duplicate: ${fileName} -> Duplicates/`));
    }

    async executeRule(filePath, rule){
        const fileName = path.basename(filePath);
        const destinationDir = path.resolve(rule.destination);
        const destinationPath = path.join(destinationDir,fileName);

        await this.ensureDirectoryExists(destinationDir); 
        let finalDestination = destinationPath;
        let counter = 1;

        while(true){
            try{
                await fs.access(finalDestination);
                const ext = path.extname(fileName); //here we take the extension name
                const nameWithoutExt = path.basename(fileName,ext);
                finalDestination = path.join(destinationDir, `${nameWithoutExt}_${counter}${ext}`);
                counter++;
            }catch(err){
                break;
            }
        }

        try{
            switch (rule.action){
                case 'move':
                    await fs.rename(filePath,finalDestination);
                    console.log(chalk.green(`📁 Moved: ${fileName} -> ${rule.destination}`));
                    break;
                case 'copy':
                    await fs.copyFile(filePath,finalDestination);
                    console.log(chalk.blue(`📋 Copied: ${fileName} -> ${rule.destination}`));
                    break;
                case 'delete':
                    await fs.unlink(filePath);
                    console.log(chalk.red(`🗑️ Deleted: ${fileName}`)); // Fixed: was 'console,log'
                    break;
            }
            return finalDestination;
        }catch(error){
            console.error(chalk.red(`Error executing rule for ${filePath}:`),error.message);
            return null;
        }
    }



    async organizeDirectory(directoryPath,options = {}){
        await this.ensureInitialized();
        const organizationTask = async () => {
            let processedCount = 0;
            let duplicateCount = 0;
            let errors = 0;
            
            const files = await fs.readdir(directoryPath,{withFileTypes: true});
            for(const file of files){
                const filePath = path.join(directoryPath,file.name);
                if(file.isFile()){
                    const result = await this.processFile(filePath); 
                    if(result && result.type === 'duplicate'){
                        duplicateCount++;
                    }else if(result && result.type === 'organized'){
                        processedCount++;
                    }
                }else if(file.isDirectory() && options.recursive){
                    await this.organizeDirectory(filePath,options);
                }
            }
            
            console.log(chalk.green(`\nOrganization complete!`));
            console.log(chalk.blue(`Processed: ${processedCount} files`));
            console.log(chalk.yellow(`Duplicates found: ${duplicateCount}`));
            if(errors > 0){
                console.log(chalk.red(`Errors encountered: ${errors}`));
            }
        };

        try {
            await oraPromise(organizationTask, 'Organizing files...');
        } catch(error) {
            console.error(chalk.red(`Error organizing directory ${directoryPath}:`),error.message);
        }
    }

    async watchDirectory(directoryPath){
        console.log(chalk.blue(`Watching directory: ${directoryPath}`));
        console.log(chalk.gray('Press Ctrl+C to stop watching.'));

        const watcher = chokidar.watch(directoryPath, {
            ignored:/^\./,
            persistent: true,
            ignoreInitial: true,
        });
        
        watcher.on('add',async (filePath) => {
            console.log(chalk.cyan(`\nNew File detected: ${path.basename(filePath)}`));
            setTimeout(async () => {
                await this.processFile(filePath);
            },1000);
        });

        watcher.on('error', (error) => {
            console.error(chalk.red('Watcher error:'),error);
        });

        //keep the process running
        process.on('SIGINT', () => {
            console.log(chalk.yellow('\nStopping watcher...')); 
            watcher.close();
            process.exit(0);
        });
    }

    async listRules(){
        await this.ensureInitialized();
        const table = new Table({
            head: ['ID','Name','Conditions','Destination','Action','Enabled'],
            style:{head:['cyan']}
        });
        this.rules.forEach(rule => {
            const conditions = Object.entries(rule.conditions)
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ');
            table.push([
                rule.id,
                rule.name,
                conditions,
                rule.destination,
                rule.action,
                rule.enabled ? 'Yes' : 'No'
            ]);
        });
        console.log(table.toString());
    }

    async addRule(){
        await this.ensureInitialized();
        const answers = await inquirer.prompt([ 
            {
                type: 'input',
                name: 'name',
                message: 'Enter rule name:',
                validate: input => input ? true : 'Rule name cannot be empty.'
            },
            {
                type: 'list',
                name: 'conditionType', 
                message: 'Condition type:',
                choices: [
                    {name: 'File Extension', value: 'extensions'}, 
                    {name: 'File Name Contains', value: 'nameContains'},
                    {name: 'File Size Greater Than', value: 'sizeGreaterThan'},
                    {name: 'Older Than Days', value: 'olderThanDays'}
                ]
            },
            {
                type: 'input',
                name: 'conditionValue',
                message: 'Condition value:',
                validate: input => input.trim() !== '' || 'Condition value cannot be empty'
            },
            {
                type: 'input',
                name: 'destination',
                message: 'Destination directory:',
                validate: input => input.trim() !== '' || 'Destination cannot be empty'
            },
            {
                type: 'list',
                name: 'action',
                message: 'Action:',
                choices: ['move', 'copy', 'delete']
            }
        ]);

        const rule = {
            id: Math.random().toString(36).substr(2, 9), 
            name: answers.name,
            conditions: {[answers.conditionType]: answers.conditionValue},
            destination: answers.destination,
            action: answers.action,
            enabled: true
        };
        this.rules.push(rule);
        await this.saveConfig();
        console.log(chalk.green(`Rule added: ${rule.name}`));
    }

    async toggleRule(ruleId){
        await this.ensureInitialized();
        const rule = this.rules.find(rule => rule.id === ruleId);
        if(!rule){
            console.log(chalk.red('Rule not found.'));
            return;
        }
        rule.enabled = !rule.enabled;
        await this.saveConfig();
        console.log(chalk.green(`Rule ${rule.enabled ? 'enabled' : 'disabled'}: ${rule.name}`));
    }

    async removeRule(ruleId){
        await this.ensureInitialized();
        const ruleIndex = this.rules.findIndex(rule => rule.id === ruleId);
        if(ruleIndex === -1){
            console.log(chalk.red('Rule not found.'));
            return;
        }
        this.rules.splice(ruleIndex, 1);
        await this.saveConfig();
        console.log(chalk.green(`Rule removed: ${ruleId}`));
    }
    
    async enableRule(ruleId){
        const rule = this.rules.find(rule => rule.id === ruleId);
        if(!rule){
            console.log(chalk.red('Rule not found.'));
            return;
        }
        rule.enabled = true;
        await this.saveConfig();
        console.log(chalk.green(`Rule enabled: ${rule.name}`));
    }
}

//Here we set up the CLI interface thike :)

const organizer = new FileOrganizer();

program
    .name('file-organizer')
    .description('Automatically organize files in a directory')
    .version('1.0.0');

program
    .command('organize')
    .description('Organize files in a directory')
    .option('-d, --directory <path>', 'Directory to organize', process.cwd())
    .option('-r,--recursive', 'Process subdirectories recursively') 
    .action(async (options) => {
        await organizer.organizeDirectory(options.directory,options);
    });

program
    .command('watch')
    .description('Watch a directory for new files and organize them')
    .option('-d,--directory <path>', 'Directory to watch', path.join(os.homedir(),'Downloads'))
    .action(async (options) => {
        await organizer.watchDirectory(options.directory);
    });

program
    .command('rules')
    .description('List all organization rules')
    .action(async () => {
        await organizer.listRules();
    });

program
    .command('add-rule')
    .description('Add a new organization rule')
    .action(async () => {
        await organizer.addRule();
    });

program
    .command('remove-rule')
    .description('Remove an organization rule')
    .argument('<id>', 'ID of the rule to remove')
    .action(async (id) => {
        await organizer.removeRule(id);
    });

program
    .command('toggle-rule')
    .description('Enable or disable an organization rule')
    .argument('<id>', 'ID of the rule to toggle')
    .action(async (id) => {
        await organizer.toggleRule(id);
    }); 

program
    .command('downloads')
    .description('Quick organize Downloads folder')
    .action(async () => {
        const downloadsPath = path.join(os.homedir(), 'Downloads');
        await organizer.organizeDirectory(downloadsPath);
    });

program
    .command('config')
    .description('Show configuration file location')
    .action(() => {
        console.log(chalk.blue('Configuration file:'), organizer.configFile);
        console.log(chalk.blue('Configuration directory:'), organizer.configDir);
    });

// Some help commands
if (process.argv.length === 2) {
    program.outputHelp();
}

program.parse();

module.exports = FileOrganizer;
