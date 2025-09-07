# Deco docs
Created from the template:
[MCP with Astro Docs View](https://github.com/deco-cx/astro-docs-view)

A full-stack template for building
[Model Context Protocol (MCP)](https://spec.modelcontextprotocol.io/) servers
with a modern Astro documentation site. This template provides a complete
development environment where your MCP server not only exposes tools and
workflows to AI agents but also serves a beautiful documentation interface built
with Astro and Starlight.

## ✨ Features

- **🤖 MCP Server**: Cloudflare Workers-based server with typed tools and
  workflows
- **⭐ Astro Frontend**: Modern Astro app with Starlight documentation theme
- **📚 Documentation Ready**: Pre-configured Starlight theme for beautiful docs
- **🎨 Tailwind CSS**: Full Tailwind CSS integration with custom theming
- **🔧 Type Safety**: Full TypeScript support with auto-generated RPC client
  types
- **🚀 Hot Reload**: Live development with automatic rebuilding for both
  frontend and backend
- **☁️ Ready to Deploy**: One-command deployment to Cloudflare Workers

## 🚀 Quick Start

### Prerequisites

- Node.js ≥22.0.0

### Setup

```bash
# Install dependencies
npm install

# Configure your app
npm run configure

# Start development server
npm run dev
```

The server will start on `http://localhost:8787` serving both your MCP endpoints
and the Astro documentation site.

## 📁 Project Structure

```
├── server/           # MCP Server (Cloudflare Workers + Deco runtime)
│   ├── main.ts      # Server entry point with tools & workflows
│   └── deco.gen.ts  # Auto-generated integration types
└── view/            # Astro Documentation Site (Starlight theme)
    ├── src/
    │   ├── content/docs/  # Documentation content (MDX/Markdown)
    │   ├── assets/        # Static assets
    │   └── content.config.ts  # Content configuration
    └── astro.config.mjs   # Astro configuration with Starlight
```

## 🛠️ Development Workflow

- **`npm run dev`** - Start development with hot reload
- **`npm run gen`** - Generate types for external integrations
- **`npm run gen:self`** - Generate types for your own tools/workflows
- **`npm run deploy`** - Deploy to production

## 📖 Documentation Features

The template includes a fully configured Starlight documentation theme with
Tailwind CSS:

- **📝 MDX Support**: Write documentation in Markdown with React components
- **🔍 Full-Text Search**: Built-in search functionality
- **📱 Responsive Design**: Mobile-friendly documentation
- **🎨 Tailwind Theming**: Customizable theme with Tailwind CSS variables
- **🎨 Customizable Theme**: Easy to customize colors, fonts, and layout
- **📚 Auto-Generated Sidebar**: Automatic navigation from your content
  structure

## 📚 Content Management

Add documentation by creating MDX files in `view/src/content/docs/`:

```mdx
---
title: My Documentation Page
description: A brief description of this page
---

# My Documentation Page

This is a documentation page written in MDX.

## Features

- Supports **Markdown** syntax
- Can include **React components**
- Full **TypeScript** support
```

## 🎨 Customization

### Tailwind CSS Theming

The template includes full Tailwind CSS integration with custom theming. Edit
`view/src/styles/global.css` to customize your theme:

```css
@theme {
  /* Custom fonts */
  --font-sans: "Atkinson Hyperlegible";
  --font-mono: "IBM Plex Mono";

  /* Custom accent colors (currently set to green) */
  --color-accent-50: var(--color-green-50);
  --color-accent-500: var(--color-green-500);
  --color-accent-900: var(--color-green-900);

  /* Custom gray scale */
  --color-gray-50: var(--color-zinc-50);
  --color-gray-900: var(--color-zinc-900);
}
```

You can customize:

- **Fonts**: Change the sans-serif and monospace fonts
- **Accent Colors**: Modify the primary accent color scheme
- **Gray Scale**: Adjust the neutral color palette
- **Additional Styles**: Add custom Tailwind utilities

### Starlight Configuration

Edit `view/astro.config.mjs` to customize your documentation site:

```javascript
starlight({
  title: "My Documentation",
  social: [
    { icon: "github", label: "GitHub", href: "https://github.com/your-repo" },
  ],
  sidebar: [
    {
      label: "Guides",
      items: [
        { label: "Getting Started", slug: "guides/getting-started" },
      ],
    },
  ],
});
```

### Adding Content

1. Create new MDX files in `view/src/content/docs/`
2. Update the sidebar configuration in `astro.config.mjs`
3. Use Starlight components for enhanced documentation features
4. Apply Tailwind CSS classes directly in your MDX content

## 📖 Learn More

This template is built for deploying primarily on top of the
[Deco platform](https://deco.chat/about) which can be found at the
[deco-cx/chat](https://github.com/deco-cx/chat) repository.

- [Astro Documentation](https://docs.astro.build/)
- [Starlight Documentation](https://starlight.astro.build/)
- [Deco Platform](https://deco.chat/)

---

**Ready to build your next MCP server with beautiful documentation?
[Get started now!](https://deco.chat)**
