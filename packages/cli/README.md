# Deco CLI Reference

The Deco CLI is your interface for managing AI-native projects built with
[deco.chat](https://deco.chat).

Official docs: https://docs.deco.page/

---

## Authentication

| Command       | Description                                                  |
| ------------- | ------------------------------------------------------------ |
| `deco login`  | Authenticate and store an API token for subsequent commands. |
| `deco logout` | Remove local credentials and end the session.                |
| `deco whoami` | Show the currently authenticated user and workspace.         |

---

## Project Management

| Command          | Description                                                                 |
| ---------------- | --------------------------------------------------------------------------- |
| `deco create`    | Scaffold a new deco project from an official template.                      |
| `deco configure` | Re-run setup for the current directory to change workspace or app settings. |

---

## Development

| Command                     | Description                                                                                          |
| --------------------------- | ---------------------------------------------------------------------------------------------------- |
| `npm run dev`               | Preferred way to run local Worker and React frontend in watch mode.                                  |
| `deco dev`                  | (Experimental) Future unified development command.                                                   |
| `deco link [build-command]` | Link your local dev server to a public domain. Supports `-p <port>`. Example: deco link npm run dev. |

---

## Type Generation

| Command         | Description                                                                |
| --------------- | -------------------------------------------------------------------------- |
| `deco gen`      | Generate types for external integrations (`deco.gen.ts`).                  |
| `deco gen:self` | Generate types for your own tools and workflows via local `/mcp` endpoint. |

---

## Hosting & Deployment

| Command                       | Description                                                                |
| ----------------------------- | -------------------------------------------------------------------------- |
| `npm run deploy`              | Builds frontend and invokes `deco deploy`. Recommended for most use cases. |
| `deco deploy`                 | Bundle and deploy to Cloudflare Workers. Supports `-w`, `-a`, and `-l`.    |
| `deco hosting list -w <name>` | List deployed apps in a specific workspace.                                |

---

## Integrations

| Command    | Description                               |
| ---------- | ----------------------------------------- |
| `deco add` | Add and configure workspace integrations. |

---

## Maintenance

| Command       | Description                                      |
| ------------- | ------------------------------------------------ |
| `deco update` | Upgrade the CLI to the latest published version. |

---

## Getting Help

| Command       | Description                                      |
| ------------- | ------------------------------------------------ |
| `deco --help` | Display the full list of CLI commands and usage. |

---

## Configuration File

The CLI uses a local config file to store your workspace and app context. Set or
update this configuration anytime using: `deco configure`

---

## Environment Variables

| Variable              | Purpose                                                               |
| --------------------- | --------------------------------------------------------------------- |
| `DECO_CHAT_API_TOKEN` | API token for authentication (set by `deco login`).                   |
| `DECO_CHAT_API_LOCAL` | Overrides API base URL for local development.                         |
| `DECO_SELF_URL`       | Local MCP endpoint for `deco gen:self` to introspect workflows/tools. |

## Deconfig Commands

The deconfig commands allow you to interact with the deconfig filesystem - a git-like, versioned configuration manager built on Cloudflare Durable Objects.

### Authentication

Before using any deconfig commands, you must authenticate with deco.chat:

```bash
deco login
```

### Available Commands

#### `deco deconfig get`

Get a file from a deconfig branch.

```bash
deco deconfig get <path> -b <branchName> [options]
```

**Options:**
- `-b, --branch <branchName>` (required) - Branch name
- `-o, --output <file>` - Output file (defaults to stdout)

**Examples:**
```bash
# Get file and output to stdout
deco deconfig get /config.json -b main

# Get file and save to local file
deco deconfig get /config.json -b main -o ./local-config.json
```

#### `deco deconfig put`

Put a file to a deconfig branch.

```bash
deco deconfig put <path> -b <branchName> [options]
```

**Options:**
- `-b, --branch <branchName>` (required) - Branch name
- `-f, --file <file>` - Local file to upload
- `-c, --content <content>` - Content to upload directly
- `-m, --metadata <metadata>` - Metadata JSON string

**Examples:**
```bash
# Upload local file
deco deconfig put /config.json -b main -f ./local-config.json

# Upload content directly
deco deconfig put /message.txt -b main -c "Hello, World!"

# Upload with metadata
deco deconfig put /config.json -b main -f ./config.json -m '{"author":"user","version":"1.0"}'

# Upload from stdin
echo "Hello from stdin" | deco deconfig put /stdin.txt -b main
```

#### `deco deconfig watch`

Watch a deconfig branch for changes in real-time.

```bash
deco deconfig watch -b <branchName> [options]
```

**Options:**
- `-b, --branch <branchName>` (required) - Branch name
- `-p, --path <path>` - Path filter for watching specific files
- `--from-ctime <ctime>` - Start watching from this ctime (default: 1)

**Examples:**
```bash
# Watch all changes on main branch
deco deconfig watch -b main

# Watch specific path pattern
deco deconfig watch -b main -p "/config/**"

# Watch from specific change time
deco deconfig watch -b main --from-ctime 1000
```

#### `deco deconfig mount`

Mount a deconfig branch to a local directory and sync changes bidirectionally.

```bash
deco deconfig mount -b <branchName> --path <localPath> [options]
```

**Options:**
- `-b, --branch <branchName>` (required) - Branch name to mount
- `--path <path>` (required) - Local directory path to sync files to
- `--from-ctime <ctime>` - Start watching from this ctime (default: 1)
- `--path-filter <filter>` - Filter files by path pattern

**Examples:**
```bash
# Mount branch "main" to ./local directory
deco deconfig mount -b main --path ./local

# Mount with specific ctime and path filter
deco deconfig mount -b feature-branch --path ./sync --from-ctime 1000 --path-filter "/src/**"
```

### How it works

1. **Authentication**: Uses your deco.chat session (requires `deco login`)
2. **API Communication**: All commands use MCP (Model Context Protocol) tools via HTTPS
3. **Real-time Updates**: Watch and mount commands use Server-Sent Events (SSE)
4. **Content Handling**: Files are transferred as base64-encoded content
5. **Path Filtering**: Supports glob-like patterns for selective operations

### Technical Details

- **Base URL**: `https://deconfig.deco.page`
- **API Endpoints**: `/mcp/call-tool/READ_FILE`, `/mcp/call-tool/PUT_FILE`
- **Watch Endpoint**: `/watch` (Server-Sent Events)
- **Authentication**: Bearer token in Authorization header
- **Content Encoding**: Base64 for binary safety

All commands will run until completion or interruption (Ctrl+C for watch/mount commands).
