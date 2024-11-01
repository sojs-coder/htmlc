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

### If Statements

Example `components/navigation.html`
```html
<header>
    {% if (page == "main") %}
        <h1>Main</h1>
    {% elif (page == "login" || page == "signup") %}
        <h1>Auth Page</h1>
    {% else %}
        <h1>{{page}}</h1>
    {% endif %}
</header>
```

Example usage in HTML:
- `pages/login.html`
  ```html
  <cnavigation page = "login"/>
  ```
- `pages/index.html`
  ```html
  <cnavigation page = "main" />
  ```
Etc...

### For Loops

Example `components/navigation.html`
```html
<header>
    {% for link in links %}
        <a href = "/{{link}}">Go to {{link}}</a>
    {% endfor %}
</header>
```

Example HTML:
```html
<cnavigation links="login,signup,auth" />
```

> List items should be passed to properties separated by a signle comma, no space
> To render variables, follow the patter `{{varname}}`, not `{{ varname}}` or `{{ varname }}`. (Note the spaces)

## License

MIT