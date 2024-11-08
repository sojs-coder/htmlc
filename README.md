# Component Parser Library

A high-performance Node.js library for parsing and processing HTML components with support for templating, conditional rendering, loops, and nested components.

## Features

- ✨ Component-based HTML processing
- 🚀 Parallel processing using worker threads
- 🔄 Template caching for improved performance
- 🎯 Conditional rendering support
- 📦 Loop processing
- 🔍 Selective component processing
- 📁 Directory-based processing
- 🎨 Clean component syntax

## Installation

```bash
npm install @sojs_coder/htmlc -g
```

## Quick Start

1. Create a components directory in your project:

```
project/
├── components/
│   ├── header.html
│   ├── footer.html
│   └── nav/
│       └── menu.html
├── pages/
│   └── index.html
```

2. Create your components with the new syntax:

```html
<!-- components/header.html -->
<header>
  <h1>{{title}}</h1>
  {% if (showSubtitle) %}
    <h2>{{subtitle}}</h2>
  {% endif %}
</header>

<!-- components/nav/menu.html -->
<nav>
  <ul>
    {% for item in menuItems %}
      <li>{{item}}</li>
    {% endfor %}
  </ul>
</nav>
```

3. Use components in your HTML files:

```html
<!-- pages/index.html -->
<!DOCTYPE html>
<html>
<head>
    <title>My Website</title>
</head>
<body>
    <header title="Welcome" showSubtitle="true" subtitle="Hello World" />
    <nav/menu menuItems="Home,About,Contact" />
</body>
</html>
```

4. Process your pages:

```javascript
const ComponentParser = require('@sojs_coder/htmlc');

const parser = new ComponentParser('pages');
parser.processDirectory();
```

## Command Line Usage

The library can be used from the command line:

```bash
# Basic usage
htmlc pages

# With options
htmlc pages --depth=2 --names=header,footer --out=dist --logs
```

### Command Line Options

- `--depth=<n>`: Set maximum directory depth for parsing
- `--names=a,b,...`: Specify specific component names to process
- `--out=<path>`: Specify output directory
- `--logs`: Enable debug logging
- `help`: Show help information

## API Documentation

### ComponentParser Class

```javascript
const parser = new ComponentParser(directory, options);
```

#### Options

```javascript
{
  depth: number,     // Maximum directory depth (default: Infinity)
  names: string[],   // Specific component names to process
  out: string,       // Output directory path
  logs: boolean      // Enable debug logging
}
```

### Component Syntax

#### Basic Component Usage

```html
<componentName prop1="value1" prop2="value2" />
```

#### Conditional Rendering

```html
{% if (condition) %}
  Content to show if condition is true
{% endif %}

{% if (condition1) %}
  Content for condition1
{% elif (condition2) %}
  Content for condition2
{% else %}
  Default content
{% endif %}
```

#### Loops

```html
{% for item in items %}
  <div>{{item}}</div>
{% endfor %}
```

## Advanced Examples

### 1. Nested Components with Props

```html
<!-- components/card.html -->
<div class="card">
  <header title="{{title}}" showSubtitle="{{showSubtitle}}" subtitle="{{subtitle}}" />
  <div class="card-content">
    {{content}}
  </div>
  <footer copyright="{{copyright}}" />
</div>

<!-- Usage -->
<card 
  title="My Card" 
  showSubtitle="true" 
  subtitle="Card Subtitle"
  content="Card content goes here"
  copyright="2024"
/>
```

### 2. Dynamic Lists with Conditionals

```html
<!-- components/userList.html -->
<div class="user-list">
  {% if (hasUsers) %}
    {% for user in users %}
      <div class="user-card">
        <h3>{{user}}</h3>
        {% if (showEmail) %}
          <email address="{{user}}@example.com" />
        {% endif %}
      </div>
    {% endfor %}
  {% else %}
    <p>No users found</p>
  {% endif %}
</div>

<!-- Usage -->
<userList 
  hasUsers="true" 
  users="John,Jane,Bob" 
  showEmail="true"
/>
```

### 3. Programmatic Usage with Async/Await

```javascript
const ComponentParser = require('component-parser');

async function buildWebsite() {
  const parser = new ComponentParser('src', {
    depth: 3,
    names: ['header', 'footer', 'nav'],
    out: 'dist',
    logs: true
  });

  try {
    await parser.processDirectory();
    console.log('Website built successfully!');
  } catch (error) {
    console.error('Build failed:', error);
  }
}

buildWebsite();
```

## Performance Tips

1. **Template Caching**
   - Templates are automatically cached
   - Identical components with same props use cached versions

2. **Parallel Processing**
   - Large directories are processed in parallel
   - Processing is automatically distributed across available CPU cores

3. **Selective Processing**
   - Use the `names` option to process only specific components
   - Set appropriate `depth` to limit directory recursion

## Error Handling

The library throws descriptive errors for common issues:

```javascript
try {
  await parser.processDirectory();
} catch (error) {
  if (error.message.includes('Components directory not found')) {
    // Handle missing components directory
  } else if (error.message.includes('Component not found')) {
    // Handle missing component
  } else {
    // Handle other errors
  }
}
```

## Component blacklist

The following components are reserved by HTML:
```html
<area />
<base />
<br />
<col />
<embed />
<hr />
<img />
<input />
<link />
<menuitem />
<meta />
<param />
<path />
<source />
<track />
<wbr />
```
Naming convention follows `celement`. For example: `csource` instead of `source` to avoid conflicts. The same applies to non-void elements. For example use `<chead />` instead of `<head />` (`<head>` is an HTML element) 

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our repository.

## License

MIT License - feel free to use this library in your projects!