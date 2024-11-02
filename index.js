#!/usr/bin/env node

const fs = require('fs').promises;  // Use promises-based fs
const path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

// Cache void tags Set
const VOID_TAGS = new Set([
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "menuitem", "meta", "param", "source", "track", "wbr"
]);

// Precompile frequently used RegExp patterns
const COMPONENT_REGEX = /<([a-zA-Z0-9/]+)([^>]*)\/>/g;
const COMMENT_REGEX = /<!--[\s\S]*?-->/g;
const ATTR_REGEX = /(\w+)[\s]?=[\s]?"([^"]*)"/g;
const CONDITIONAL_REGEX = /{%\s*if\s*\((.*?)\)\s*%}([\s\S]*?)(?:{%\s*endif\s*%})/g;
const FOR_REGEX = /{% for\s+(\w+)\s+in\s+(\w+)\s*%}([\s\S]*?){% endfor %}/g;

class ComponentParser {
    constructor(directory, options = {}) {
        this.directory = directory;
        this.depth = options.depth ?? Infinity;
        this.names = options.names ? new Set(options.names) : null;
        this.outputDir = options.out || path.join(process.cwd(), `${directory}_processed`);
        this.enableLogs = options.logs || false;
        this.components = new Map();
        this.templateCache = new Map(); // Cache for parsed templates
    }

    log(message) {
        this.enableLogs && console.log(message);
    }

    async loadComponents() {
        const componentDir = path.join(process.cwd(), 'components');

        if (!await fs.access(componentDir).then(() => true).catch(() => false)) {
            throw new Error(`Components directory not found: ${componentDir}`);
        }

        this.log(`Loading components from: ${componentDir}`);
        await this._readComponentsRecursive(componentDir);
    }

    async _readComponentsRecursive(dir, basePath = '') {
        this.log(`Reading directory: ${dir}`);
        const files = await fs.readdir(dir);

        await Promise.all(files.map(async file => {
            const fullPath = path.join(dir, file);
            const relativePath = path.join(basePath, file);
            const stat = await fs.stat(fullPath);

            if (stat.isDirectory()) {
                await this._readComponentsRecursive(fullPath, relativePath);
            } else if (path.extname(file) === '.html') {
                const componentName = relativePath.replace(/\\/g, '/').replace(/\.html$/, '');
                const template = await fs.readFile(fullPath, 'utf-8');
                this.components.set(componentName, template);
                this.log(`Loaded component: ${componentName}`);
            }
        }));
    }

    async copyDirectoryContents(sourceDir, targetDir, currentDepth = 0) {
        if (currentDepth >= this.depth) return;
        await fs.mkdir(targetDir, { recursive: true });

        const files = await fs.readdir(sourceDir);
        await Promise.all(files.map(async file => {
            const sourcePath = path.join(sourceDir, file);
            const targetPath = path.join(targetDir, file);
            const stat = await fs.stat(sourcePath);

            if (stat.isDirectory()) {
                await this.copyDirectoryContents(sourcePath, targetPath, currentDepth + 1);
            } else {
                await fs.copyFile(sourcePath, targetPath);
            }
        }));
    }

    async findHtmlFiles(dir, currentDepth = 0) {
        if (currentDepth >= this.depth) return [];
        const files = await fs.readdir(dir);

        const htmlFiles = await Promise.all(files.map(async file => {
            const fullPath = path.join(dir, file);
            const stat = await fs.stat(fullPath);

            if (stat.isDirectory()) {
                return await this.findHtmlFiles(fullPath, currentDepth + 1);
            } else if (
                path.extname(file) === '.html' &&
                (!this.names || this.names.has(path.basename(file, '.html')))
            ) {
                return [fullPath];
            }
            return [];
        }));

        return htmlFiles.flat();
    }

    renderComponent(componentName, props, from) {
        const cacheKey = `${componentName}-${JSON.stringify(props)}`;
        if (this.templateCache.has(cacheKey)) {
            return this.templateCache.get(cacheKey);
        }

        if (!this.components.has(componentName)) {
            console.warn(`Component not found: ${componentName} (in: ${from})`);
            return null;
        }

        let template = this.components.get(componentName);
        const propsMap = new Map(Object.entries(props));

        // Process template
        template = Object.entries(props).reduce((acc, [key, value]) =>
            acc.replace(new RegExp(`{{${key}}}`, 'g'), value), template);

        template = this.parseConditionals(template, propsMap);
        template = this.parseLoops(template, propsMap);
        template = this.parseComponentTags(template, from);

        const result = `\n<!-- Component components/${componentName} -->\n${template}\n<!-- End component components/${componentName} -->\n`;
        this.templateCache.set(cacheKey, result);
        return result;
    }

    parseComponentTags(content, from) {
        const comments = [];
        content = content.replace(COMMENT_REGEX, (match) => {
            comments.push(match);
            return `<!--COMMENT_PLACEHOLDER_${comments.length - 1}-->`;
        });

        content = content.replace(COMPONENT_REGEX, (match, componentTag, attributesStr) => {
            if (VOID_TAGS.has(componentTag)) return match;

            const props = {};
            let attrMatch;
            while ((attrMatch = ATTR_REGEX.exec(attributesStr)) !== null) {
                props[attrMatch[1]] = attrMatch[2];
            }
            return this.renderComponent(componentTag, props, from) || match;
        });

        return content.replace(/<!--COMMENT_PLACEHOLDER_(\d+)-->/g,
            (_, index) => comments[index]);
    }

    parseConditionals(content, props) {
        function generateEvaluateCondition(condition) {
            const evaluateCondition = new Function('props', `
                const evaluableCondition = '${condition}'.replace(/\\b(\\w+)\\b/g, 
                    match => props.has(match) ? props.get(match) : match);
                try {
                    return new Function('return ' + evaluableCondition)();
                } catch {
                    return false;
                }
            `);
            return evaluateCondition;
        }

        return content.replace(CONDITIONAL_REGEX, (match, condition, block) => {
            const sections = block.split(/{%\s*(?:elif|else)\s*(?:\(.*?\))?\s*%}/);
            const conditions = [condition, ...(block.match(/{%\s*elif\s*\((.*?)\)\s*%}/g)?.map(c =>
                c.match(/\((.*?)\)/)[1]) || [])];
            for (let i = 0; i < conditions.length; i++) {
                const evaluateCondition = generateEvaluateCondition(conditions[i]);
                if (evaluateCondition(new Set(conditions[i]))) {
                    return sections[i].trim();
                }
            }
            return sections.length > conditions.length ? sections[sections.length - 1].trim() : '';
        });
    }

    parseLoops(content, props) {
        return content.replace(FOR_REGEX, (match, item, list, block) => {
            const items = Array.isArray(props.get(list)) ?
                props.get(list) : props.get(list).split(',');

            return items.map(val =>
                block.replace(new RegExp(`{{${item}}}`, 'g'), val)).join('');
        });
    }

    async processDirectory() {
        const inputDir = path.join(process.cwd(), this.directory);
        await this.loadComponents();
        await this.copyDirectoryContents(inputDir, this.outputDir);

        const htmlFiles = await this.findHtmlFiles(inputDir);
        const numCPUs = require('os').cpus().length;
        const chunkSize = Math.ceil(htmlFiles.length / numCPUs);

        const chunks = Array(Math.ceil(htmlFiles.length / chunkSize))
            .fill()
            .map((_, i) => htmlFiles.slice(i * chunkSize, (i + 1) * chunkSize));

        await Promise.all(chunks.map(async chunk => {
            await Promise.all(chunk.map(async filePath => {
                const content = await fs.readFile(filePath, 'utf-8');
                const processedContent = this.parseComponentTags(content, filePath);
                const relativePath = path.relative(inputDir, filePath);
                const outputPath = path.join(this.outputDir, relativePath);

                await fs.mkdir(path.dirname(outputPath), { recursive: true });
                await fs.writeFile(outputPath, processedContent);
                this.log(`Processed: ${filePath} -> ${outputPath}`);
            }));
        }));

        console.log(`\nProcessing complete. Output directory: ${this.outputDir}`);
    }
}

// Worker thread implementation
if (!isMainThread) {
    const { filePath, inputDir, outputDir, components } = workerData;
    const parser = new ComponentParser(inputDir, { out: outputDir });
    parser.components = new Map(components);

    (async () => {
        const content = await fs.readFile(filePath, 'utf-8');
        const processedContent = parser.parseComponentTags(content);
        const relativePath = path.relative(inputDir, filePath);
        const outputPath = path.join(outputDir, relativePath);

        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, processedContent);
        parentPort.postMessage({ filePath, outputPath });
    })().catch(error => parentPort.postMessage({ error: error.message }));
}

// Main execution
if (require.main === module) {
    const parseArgs = () => {
        const args = process.argv.slice(2);
        const directory = args.find(arg => !arg.startsWith('--'));

        if (!directory) {
            console.error('Please specify a directory to parse');
            process.exit(1);
        }

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

        const options = {};
        args.forEach(arg => {
            if (arg.startsWith('--depth=')) options.depth = parseInt(arg.split('=')[1], 10);
            if (arg.startsWith('--names=')) options.names = arg.split('=')[1].split(',');
            if (arg.startsWith('--out=')) options.out = arg.split('=')[1];
            if (arg === '--logs') options.logs = true;
        });

        return { directory, options };
    };

    (async () => {
        try {
            const { directory, options } = parseArgs();
            const parser = new ComponentParser(directory, options);
            await parser.processDirectory();
        } catch (error) {
            console.error('Error:', error.message);
            process.exit(1);
        }
    })();
}

module.exports = ComponentParser;