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
        // Stop if max depth is reached
        if (currentDepth >= this.depth) return;

        // Ensure target directory exists
        fs.mkdirSync(targetDir, { recursive: true });

        this.log(`Copying contents from: ${sourceDir}`);

        // Read directory contents
        const files = fs.readdirSync(sourceDir);

        files.forEach(file => {
            const sourcePath = path.join(sourceDir, file);
            const targetPath = path.join(targetDir, file);
            const stat = fs.statSync(sourcePath);

            if (stat.isDirectory()) {
                // Recursively copy subdirectories
                this.copyDirectoryContents(sourcePath, targetPath, currentDepth + 1);
            } else {
                // Copy files
                fs.copyFileSync(sourcePath, targetPath);
            }
        });
    }

    // Recursively find HTML files in the specified directory
    findHtmlFiles(dir, currentDepth = 0) {
        // Stop if max depth is reached
        if (currentDepth >= this.depth) return [];

        let htmlFiles = [];

        // Read directory contents
        const files = fs.readdirSync(dir);

        files.forEach(file => {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                // Recursively search subdirectories
                htmlFiles = htmlFiles.concat(
                    this.findHtmlFiles(fullPath, currentDepth + 1)
                );
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

        // Replace props in template
        Object.entries(props).forEach(([key, value]) => {
            template = template.replace(new RegExp(`{{${key}}}`, 'g'), value);
        });
        const start = `\n<!-- Component components/${componentName} -->\n`
        const end = `\n<!-- End component components/${componentName} -->\n`
        return `${start}${template}${end}`;
    }

    // Parse an HTML file, replacing component tags
    parseHtmlFile(filePath) {
        let content = fs.readFileSync(filePath, 'utf-8');

        // Regular expression to find custom component tags
        const componentRegex = /<(c[a-zA-Z0-9]+)([^>]*)\/>/g;

        content = content.replace(componentRegex, (match, componentTag, attributesStr) => {
            // Remove 'c' prefix and get component name
            const componentName = componentTag.slice(1);
            // Parse attributes
            const props = {};
            const attrRegex = /(\w+)[\s]?=[\s]?"([^"]*)"/g;
            let attrMatch;
            while ((attrMatch = attrRegex.exec(attributesStr)) !== null) {
                props[attrMatch[1]] = attrMatch[2];
            }

            // Render component
            return this.renderComponent(componentName, props);
        });

        return content;
    }

    // Process all HTML files in the specified directory
    processDirectory() {
        const inputDir = path.join(process.cwd(), this.directory);

        // Copy all directory contents first
        this.copyDirectoryContents(inputDir, this.outputDir);

        // Find all HTML files
        const htmlFiles = this.findHtmlFiles(inputDir);

        // Process each HTML file
        htmlFiles.forEach(filePath => {
            const processedContent = this.parseHtmlFile(filePath);
            
            // Construct output path (replace input dir with output dir)
            const relativePath = path.relative(inputDir, filePath);
            const outputPath = path.join(this.outputDir, relativePath);

            // Ensure output directory exists
            fs.mkdirSync(path.dirname(outputPath), { recursive: true });

            // Write processed content
            fs.writeFileSync(outputPath, processedContent);

            this.log(`Processed: ${filePath} -> ${outputPath}`);
        });

        console.log(`\nProcessing complete. Output directory: ${this.outputDir}`);
    }
}

// Parse command line arguments
const parseArgs = () => {
    const args = process.argv.slice(2);
    const options = {};

    // Find directory (first non-option argument)
    const directory = args.find(arg => !arg.startsWith('--'));
    if (!directory) {
        console.error('Please specify a directory to parse');
        process.exit(1);
    }

    // Parse options
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