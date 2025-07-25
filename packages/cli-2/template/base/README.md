# Deco Tools and Workflows

This is a simple template for creating Tools and Workflows on deco.chat

## Getting Started

1. **Login to Deco:**
   ```bash
   deco login
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure your workspace:**
   ```bash
   deco configure
   ```
   Enter your workspace name and app name when prompted.

4. **Start development:**
   ```bash
   deco dev
   ```

5. **Deploy to production:**
   ```bash
   deco deploy
   ```

## Project Structure

- `main.ts` - Main entry point for your worker
- `wrangler.toml` - Cloudflare Workers configuration
- `package.json` - Dependencies and scripts

## Customization

Edit `main.ts` to add your own Tools and Workflows.

## Learn More

- [Deco Documentation](https://docs.deco.chat)
- [Hono Framework](https://hono.dev)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
