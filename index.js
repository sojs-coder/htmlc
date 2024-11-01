#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class ComponentParser {
    constructor(directory, options = {}) {
        this.directory = directory;
        this.depth = options.depth === undefined ? Infinity : options.depth;
        this.names = options.names ? new Set(options.names) : null;
        this.outputDir = options.out || path.join(process.cwd(), `${directory}_processed`);
        this.enableLogs = options.logs || false;
        this.components = new Map();
        this.loadComponents();
    }

    // Logging method
    log(message) {
        if (this.enableLogs) {
            console.log(message);
        }
    }

    // Load all components from the directory
    loadComponents() {
        const componentDir = path.join(process.cwd(), 'components');
        
        // Ensure components directory exists
        if (!fs.existsSync(componentDir)) {
            throw new Error(`Components directory not found: ${componentDir}`);
        }

        this.log(`Loading components from: ${componentDir}`);

        // Read all HTML files in the components directory
        fs.readdirSync(componentDir)
            .filter(file => path.extname(file) === '.html')
            .forEach(file => {
                const componentName = path.basename(file, '.html');
                const componentPath = path.join(componentDir, file);
                const template = fs.readFileSync(componentPath, 'utf-8');
                this.components.set(componentName, template);
                this.log(`  Loaded component: ${componentName}`);
            });
    }

    // Recursively copy directory contents
    copyDirectoryContents(sourceDir, targetDir, currentDepth = 0) {
        if (currentDepth >= this.depth) return;
        fs.mkdirSync(targetDir, { recursive: true });
        this.log(`Copying contents from: ${sourceDir}`);
        const files = fs.readdirSync(sourceDir);

        files.forEach(file => {
            const sourcePath = path.join(sourceDir, file);
            const targetPath = path.join(targetDir, file);
            const stat = fs.statSync(sourcePath);

            if (stat.isDirectory()) {
                this.copyDirectoryContents(sourcePath, targetPath, currentDepth + 1);
            } else {
                fs.copyFileSync(sourcePath, targetPath);
            }
        });
    }

    // Find HTML files in the specified directory
    findHtmlFiles(dir, currentDepth = 0) {
        if (currentDepth >= this.depth) return [];
        let htmlFiles = [];
        const files = fs.readdirSync(dir);

        files.forEach(file => {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                htmlFiles = htmlFiles.concat(this.findHtmlFiles(fullPath, currentDepth + 1));
            } else if (
                path.extname(file) === '.html' && 
                (!this.names || this.names.has(path.basename(file, '.html')))
            ) {
                htmlFiles.push(fullPath);
            }
        });

        return htmlFiles;
    }

    // Render a component with its props
    renderComponent(componentName, props) {
        if (!this.components.has(componentName)) {
            throw new Error(`Component not found: ${componentName}`);
        }
    
        let template = this.components.get(componentName);
        
        // Convert props to a Map for the parsers
        const propsMap = new Map(Object.entries(props));
        
        // First, handle basic prop replacements
        Object.entries(props).forEach(([key, value]) => {
            template = template.replace(new RegExp(`{{${key}}}`, 'g'), value);
        });
    
        // Process conditionals
        template = this.parseConditionals(template, propsMap);
        
        // Process loops (if you have any)
        template = this.parseLoops(template, propsMap);
    
        const start = `\n<!-- Component components/${componentName} -->\n`;
        const end = `\n<!-- End component components/${componentName} -->\n`;
        
        // Return only the processed content
        return `${start}${template}${end}`;
    }

    // Parse an HTML file, replacing component tags and handling new syntax
    parseHtmlFile(filePath) {
        let content = fs.readFileSync(filePath, 'utf-8');

        // Replace component tags
        const componentRegex = /<(c[a-zA-Z0-9]+)([^>]*)\/>/g;
        content = content.replace(componentRegex, (match, componentTag, attributesStr) => {
            const componentName = componentTag.slice(1);
            const props = {};
            const attrRegex = /(\w+)[\s]?=[\s]?"([^"]*)"/g;
            let attrMatch;
            while ((attrMatch = attrRegex.exec(attributesStr)) !== null) {
                props[attrMatch[1]] = attrMatch[2];
            }
            return this.renderComponent(componentName, props);
        });

        return content;
    }

    parseConditionals(content, props) {
        // Helper function to evaluate a condition with props
        const evaluateCondition = (condition) => {
            let evaluableCondition = condition;
            props.forEach((value, key) => {
                const regex = new RegExp('\\b' + key + '\\b', 'g');
                const replacementValue = typeof value === 'string' ? `"${value}"` : value;
                evaluableCondition = evaluableCondition.replace(regex, replacementValue);
            });
            
            try {
                return new Function(`return ${evaluableCondition}`)();
            } catch (error) {
                console.error(`Error evaluating condition: ${condition}`, error);
                return false;
            }
        };
    
        // Process all conditional blocks
        let result = content;
        const conditionalRegex = /{%\s*if\s*\((.*?)\)\s*%}([\s\S]*?)(?:{%\s*endif\s*%})/g;
        
        result = result.replace(conditionalRegex, (match, condition, block) => {
            // Split the block into if/elif/else sections
            const sections = block.split(/{%\s*(?:elif|else)\s*(?:\(.*?\))?\s*%}/);
            const conditions = [condition, ...block.match(/{%\s*elif\s*\((.*?)\)\s*%}/g)?.map(c => 
                c.match(/\((.*?)\)/)[1]
            ) || []];
            
            // Check each condition in order
            for (let i = 0; i < conditions.length; i++) {
                if (evaluateCondition(conditions[i])) {
                    // Return the content for the first matching condition
                    return sections[i].trim();
                }
            }
            
            // If no conditions match and there's an else block, return that
            if (sections.length > conditions.length) {
                return sections[sections.length - 1].trim();
            }
            
            return '';
        });
    
        return result;
    }

    // Process for loops
    parseLoops(content, props) {
        const forRegex = /{% for\s+(\w+)\s+in\s+(\w+)\s*%}([\s\S]*?){% endfor %}/g;
        return content.replace(forRegex, (match, item, list, block) => {
            if (Array.isArray(this.components.get(list))) {
                return props.get(list)
                    .map(val => block.replace(new RegExp(`{{${item}}}`, 'g'), val))
                    .join('');
            }else{
                return props.get(list)
                    .split(',')
                    .map(val => block.replace(new RegExp(`{{${item}}}`, 'g'), val))
                    .join('');
            }
        });
    }

    // Process all HTML files in the specified directory
    processDirectory() {
        const inputDir = path.join(process.cwd(), this.directory);
        this.copyDirectoryContents(inputDir, this.outputDir);
        const htmlFiles = this.findHtmlFiles(inputDir);

        htmlFiles.forEach(filePath => {
            const processedContent = this.parseHtmlFile(filePath);
            const relativePath = path.relative(inputDir, filePath);
            const outputPath = path.join(this.outputDir, relativePath);
            fs.mkdirSync(path.dirname(outputPath), { recursive: true });
            fs.writeFileSync(outputPath, processedContent);
            this.log(`Processed: ${filePath} -> ${outputPath}`);
        });

        console.log(`\nProcessing complete. Output directory: ${this.outputDir}`);
    }
}

// Parse command line arguments with help option
const parseArgs = () => {
    const args = process.argv.slice(2);
    const options = {};
    const directory = args.find(arg => !arg.startsWith('--'));

    if (!directory) {
        console.error('Please specify a directory to parse');
        process.exit(1);
    }

    // Parse options and help command
    if (args.includes('help')) {
        console.log(`
Options:
  --depth=<n>       Set max directory depth for parsing.
  --names=a,b,...   Specify specific component names to render.
  --out=<path>      Specify output directory.
  --logs            Enable logging for debug.
  help              Show help with list of options.
`);
        process.exit(0);
    }

    args.forEach(arg => {
        if (arg.startsWith('--depth=')) {
            options.depth = parseInt(arg.split('=')[1], 10);
        }
        if (arg.startsWith('--names=')) {
            options.names = arg.split('=')[1].split(',');
        }
        if (arg.startsWith('--out=')) {
            options.out = arg.split('=')[1];
        }
        if (arg === '--logs') {
            options.logs = true;
        }
    });

    return { directory, options };
};

// Main execution
try {
    const { directory, options } = parseArgs();
    const parser = new ComponentParser(directory, options);
    parser.processDirectory();
} catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
}
