# htmlc - HTML Component Parser

`htmlc` is a CLI tool for parsing and transforming static HTML files with component-based templating.

## Installation

```bash
npm install -g htmlc
```

## Usage

```bash
# Basic usage
htmlc <directory>

# With options
htmlc <directory> --depth=2 --names=index,login --out=built --logs
```

### Options

- `<directory>`: Source directory containing HTML files
- `--depth=<num>`: Maximum subdirectory depth to parse (default: all)
- `--names=<list>`: Comma-separated list of HTML file names to process
- `--out=<dir>`: Output directory for processed files
- `--logs`: Enable verbose logging

## Components

Create components in a `components/` directory. Use `c` prefix for custom components.

Example `components/navigation.html`:
```html
<header>{{prop1}} {{prop2}}</header>
```

Example usage in HTML:
```html
<cnavigation prop1="Welcome" prop2="to my site" />
```

## License

MIT