# mnehmos.roo.code - Knowledge Base Document

## Quick Reference

| Property             | Value                                       |
| -------------------- | ------------------------------------------- |
| **Repository**       | https://github.com/Mnehmos/mnehmos.roo.code |
| **Primary Language** | TypeScript                                  |
| **Project Type**     | VS Code Extension / AI Coding Agent         |
| **Status**           | Active                                      |
| **Last Updated**     | 2025-12-29                                  |

## Overview

mnehmos.roo.code is a fork of Roo Code (formerly Cline), a powerful VS Code extension that functions as an AI-powered development team directly within your editor. It integrates multiple AI providers (Anthropic Claude, OpenAI, local models via Ollama, etc.) to provide intelligent code generation, debugging, refactoring, and documentation capabilities. The extension features multiple operational modes (Code, Architect, Ask, Debug, Custom) and supports the Model Context Protocol (MCP) for extensible tool integration.

## Architecture

### System Design

The project follows a monorepo architecture using pnpm workspaces and Turbo for build orchestration. It consists of a VS Code extension with multiple specialized packages:

- **VS Code Extension Pattern**: The main extension activates in VS Code and provides a webview-based UI for user interaction
- **Multi-Provider Architecture**: Abstracted API handlers support 30+ AI providers including Anthropic, OpenAI, Bedrock, Vertex AI, and local solutions
- **MCP Integration**: Implements the Model Context Protocol SDK for extensible tool capabilities
- **Monorepo Structure**: Packages are organized for code reuse across the extension, webview, and standalone components
- **Event-Driven Communication**: Uses message passing between extension host and webview UI via VS Code's webview API

### Key Components

| Component            | Purpose                                                    | Location                     |
| -------------------- | ---------------------------------------------------------- | ---------------------------- |
| Extension Entry      | Main VS Code extension activation and lifecycle management | `src/extension.ts`           |
| API Handlers         | Multi-provider AI model integration layer                  | `src/api/`                   |
| Core Logic           | Platform-agnostic business logic including custom tools    | `packages/core/src/`         |
| Webview UI           | React-based user interface for task interaction            | `webview-ui/`                |
| Type Definitions     | Shared TypeScript types across the monorepo                | `packages/types/src/`        |
| Cloud Services       | Roo Code Cloud integration and sync                        | `packages/cloud/`            |
| Telemetry            | PostHog analytics integration                              | `packages/telemetry/`        |
| Activation Handlers  | Command registration and URI handling                      | `src/activate/`              |
| MCP Server Manager   | Model Context Protocol server lifecycle management         | `src/services/mcp/`          |
| Code Index Manager   | Semantic code search using Qdrant vector database          | `src/services/code-index/`   |
| Terminal Integration | Shell command execution and output capture                 | `src/integrations/terminal/` |

### Data Flow

```
User Input (Webview)
  → IPC Message
  → ClineProvider (Extension Host)
  → ApiHandler (Provider-specific)
  → AI Model API
  → Streaming Response
  → Tool Execution (MCP/Native)
  → File Operations / Terminal Commands
  → Response Presentation
  → User Approval/Feedback Loop
```

## API Surface

### Public Interfaces

#### Extension API (exported via `src/extension/api.ts`)

The extension exposes a VS Code extension API that other extensions can consume:

- **Purpose**: Allows external VS Code extensions to interact with Roo Code programmatically
- **Returns**: `API` object with methods for task management and integration

#### MCP Tools (via Model Context Protocol)

Roo Code can connect to MCP servers that expose additional tools. Standard tool categories include:

- File operations (read, write, edit)
- Web search and browsing
- Database queries
- API integrations
- Custom domain-specific tools

#### Custom Tool Registry (`@roo-code/core`)

- **Tool**: `customToolRegistry`
- **Purpose**: Allows registration of custom TypeScript-based tools
- **Parameters**:
    - Tool definition files (TypeScript/JavaScript)
    - ESBuild-based runtime compilation
- **Returns**: Executable tool instances with XML or native function calling format

### Configuration

| Variable                                       | Type     | Default                               | Description                                              |
| ---------------------------------------------- | -------- | ------------------------------------- | -------------------------------------------------------- |
| `mnehmos-roo.allowedCommands`                  | string[] | `["git log", "git diff", "git show"]` | Shell commands allowed without approval                  |
| `mnehmos-roo.deniedCommands`                   | string[] | `[]`                                  | Shell commands always denied                             |
| `mnehmos-roo.commandExecutionTimeout`          | number   | `0`                                   | Timeout for command execution in seconds (0 = unlimited) |
| `mnehmos-roo.preventCompletionWithOpenTodos`   | boolean  | `false`                               | Prevent task completion if todo items remain             |
| `mnehmos-roo.apiRequestTimeout`                | number   | `600`                                 | API request timeout in seconds                           |
| `mnehmos-roo.enableCodeActions`                | boolean  | `true`                                | Enable quick actions in editor context menu              |
| `mnehmos-roo.useAgentRules`                    | boolean  | `true`                                | Use .roorules files for project-specific instructions    |
| `mnehmos-roo.maximumIndexedFilesForFileSearch` | number   | `10000`                               | Maximum files to index for semantic search               |
| `mnehmos-roo.codeIndex.embeddingBatchSize`     | number   | `60`                                  | Batch size for embedding generation                      |
| `mnehmos-roo.debug`                            | boolean  | `false`                               | Enable debug logging                                     |

## Usage Examples

### Basic Usage

```typescript
// Activating the extension programmatically
import * as vscode from "vscode"

// Open Roo Code in sidebar
await vscode.commands.executeCommand("mnehmos-roo.plusButtonClicked")

// Add selected code to context
await vscode.commands.executeCommand("mnehmos-roo.addToContext")

// Explain selected code
await vscode.commands.executeCommand("mnehmos-roo.explainCode")
```

### Advanced Patterns - Custom Tool Registration

```typescript
// Example custom tool definition (my-tools/calculator.ts)
import { CustomTool } from "@roo-code/types"

export const calculatorTool: CustomTool = {
	name: "calculator",
	description: "Performs mathematical calculations",
	schema: {
		expression: {
			type: "string",
			description: "Mathematical expression to evaluate",
		},
	},
	async execute({ expression }) {
		// Safe eval implementation
		const result = eval(expression)
		return { result: String(result) }
	},
}

// The tool registry will auto-discover and load this tool
// when placed in the configured custom tools directory
```

### Provider Integration Example

```typescript
// From src/api/index.ts - Building an API handler
import { buildApiHandler } from "./api"
import type { ProviderSettings } from "@roo-code/types"

const config: ProviderSettings = {
	apiProvider: "anthropic",
	apiKey: process.env.ANTHROPIC_API_KEY,
	apiModelId: "claude-sonnet-4-5-20250929",
}

const handler = buildApiHandler(config)

// Create a streaming message
const stream = handler.createMessage(
	"You are a helpful coding assistant",
	[{ role: "user", content: "Explain how async/await works" }],
	{ taskId: "task-123", mode: "ask" },
)

// Process streaming response
for await (const chunk of stream) {
	console.log(chunk)
}
```

## Dependencies

### Runtime Dependencies

| Package                   | Version          | Purpose                                        |
| ------------------------- | ---------------- | ---------------------------------------------- |
| @anthropic-ai/sdk         | ^0.37.0          | Anthropic Claude API integration               |
| @modelcontextprotocol/sdk | 1.12.0           | Model Context Protocol implementation          |
| openai                    | ^5.12.2          | OpenAI API and compatible providers            |
| @qdrant/js-client-rest    | ^1.14.0          | Vector database for semantic code search       |
| vscode                    | ^1.84.0          | VS Code extension API                          |
| tiktoken                  | ^1.0.21          | Token counting for context management          |
| zod                       | 3.25.61          | Runtime type validation and schema definitions |
| react                     | (via webview-ui) | UI framework for webview interface             |

### Development Dependencies

| Package      | Version | Purpose                                |
| ------------ | ------- | -------------------------------------- |
| typescript   | 5.8.3   | TypeScript compiler                    |
| esbuild      | ^0.25.0 | Fast JavaScript bundler                |
| turbo        | ^2.5.6  | Monorepo build orchestration           |
| pnpm         | 10.8.1  | Package manager with workspace support |
| @vscode/vsce | 3.3.2   | VS Code extension packaging tool       |
| vitest       | ^3.2.3  | Unit testing framework                 |
| eslint       | ^9.27.0 | Code linting and style enforcement     |

## Integration Points

### Works With

| Project                 | Integration Type | Description                                                     |
| ----------------------- | ---------------- | --------------------------------------------------------------- |
| MCP Servers             | Extension        | Connects to any MCP-compatible server for extended capabilities |
| Roo Code Cloud          | Peer             | Optional cloud sync and remote task control (Roomote)           |
| VS Code Language Models | Extension        | Can use VS Code's native language model API                     |

### External Services

| Service          | Purpose                       | Required                   |
| ---------------- | ----------------------------- | -------------------------- |
| Anthropic API    | Claude model access           | No (one of many providers) |
| OpenAI API       | GPT model access              | No (one of many providers) |
| AWS Bedrock      | Claude/other models via AWS   | No (optional provider)     |
| Google Vertex AI | Gemini/Claude models via GCP  | No (optional provider)     |
| PostHog          | Telemetry and analytics       | No (opt-out available)     |
| Roo Code Cloud   | Task sync and Roomote Control | No (optional feature)      |

## Development Guide

### Prerequisites

- Node.js 20.19.2 (specified in .nvmrc and package.json)
- pnpm 10.8.1 (specified in package.json packageManager field)
- VS Code 1.84.0 or later
- Git for version control

### Setup

```bash
# Clone the repository
git clone https://github.com/Mnehmos/mnehmos.roo.code
cd mnehmos.roo.code

# Install dependencies (pnpm workspaces will handle all packages)
pnpm install

# Setup will automatically run via preinstall/install hooks
# to bootstrap workspace packages
```

### Running Locally

```bash
# Development mode (F5 in VS Code for debugging)
# Opens a new VS Code window with the extension loaded
# Changes auto-reload for both extension and webview

# Alternatively, build and install VSIX
pnpm install:vsix

# Watch mode for TypeScript compilation
pnpm run watch:tsc

# Watch mode for bundling
pnpm run watch:bundle
```

### Testing

```bash
# Run all tests across workspaces
pnpm test

# Run tests for specific package
pnpm --filter @roo-code/core test

# Run e2e tests
pnpm --filter @roo-code/vscode-e2e test:run

# Type checking across all packages
pnpm check-types
```

### Building

```bash
# Build all packages
pnpm build

# Bundle the extension
pnpm bundle

# Create VSIX package
pnpm vsix

# Output location
# VSIX file will be in bin/ directory (e.g., bin/mnehmos-roo-3.38.0.vsix)
```

### Project Structure Commands

```bash
# Lint all code
pnpm lint

# Format all code with Prettier
pnpm format

# Clean build artifacts
pnpm clean

# Version bump with changesets
pnpm changeset:version
```

## Maintenance Notes

### Known Issues

1. This is a fork of Roo Code with custom branding (mnehmos-roo) - some upstream features may need adaptation
2. Extension ID changed to `mnehmos.mnehmos-roo` to avoid conflicts with the official Roo Code extension
3. The `.roo/` directory is gitignored to prevent task history conflicts
4. Token counting for some providers relies on tiktoken approximations rather than native APIs

### Future Considerations

1. Continue syncing relevant upstream Roo Code improvements and bug fixes
2. Consider contributing fork-specific enhancements back to Roo Code upstream
3. Evaluate custom MCP server integrations for domain-specific workflows
4. Monitor API provider changes and deprecations across 30+ supported providers
5. Improve test coverage particularly for provider-specific edge cases

### Code Quality

| Metric        | Status                                                         |
| ------------- | -------------------------------------------------------------- |
| Tests         | Yes with partial coverage (Vitest for core, e2e for extension) |
| Linting       | ESLint with custom config (@roo-code/config-eslint)            |
| Type Safety   | TypeScript strict mode enabled                                 |
| Documentation | README, CONTRIBUTING, inline JSDoc comments                    |

---

## Appendix: File Structure

```
mnehmos.roo.code/
├── src/                          # Main VS Code extension source
│   ├── extension.ts              # Extension entry point and activation
│   ├── activate/                 # Command and action registration
│   ├── api/                      # AI provider integrations
│   │   ├── index.ts              # Provider factory (buildApiHandler)
│   │   ├── providers/            # 30+ provider implementations
│   │   └── transform/            # Response streaming and transformation
│   ├── core/                     # Core business logic
│   │   ├── assistant-message/    # AI response parsing and presentation
│   │   ├── auto-approval/        # Command auto-approval logic
│   │   ├── config/               # Configuration management
│   │   ├── prompts/              # System prompts and templates
│   │   └── webview/              # Webview provider and communication
│   ├── integrations/             # External integrations
│   │   ├── claude-code/          # Claude Code OAuth
│   │   ├── editor/               # Editor diff views and decorations
│   │   └── terminal/             # Terminal command execution
│   └── services/                 # Extension services
│       ├── mcp/                  # MCP server management
│       ├── code-index/           # Semantic code search with Qdrant
│       └── mdm/                  # Mobile Device Management
├── packages/                     # Shared workspace packages
│   ├── core/                     # Platform-agnostic core (@roo-code/core)
│   │   └── src/custom-tools/     # Custom tool registry and execution
│   ├── types/                    # Shared TypeScript types (@roo-code/types)
│   ├── cloud/                    # Roo Code Cloud integration (@roo-code/cloud)
│   ├── telemetry/                # Analytics and telemetry (@roo-code/telemetry)
│   ├── ipc/                      # Inter-process communication (@roo-code/ipc)
│   └── config-*/                 # Shared ESLint and TypeScript configs
├── webview-ui/                   # React-based webview interface
├── apps/                         # Standalone applications
│   ├── vscode-e2e/               # End-to-end tests
│   ├── web-roo-code/             # Web version of Roo Code
│   └── web-evals/                # Evaluation benchmarks UI
├── scripts/                      # Build and automation scripts
├── package.json                  # Root package configuration and workspace definition
├── pnpm-workspace.yaml           # pnpm workspace configuration
├── turbo.json                    # Turborepo build configuration
├── README.md                     # User-facing documentation
├── CONTRIBUTING.md               # Contributor guidelines
└── PROJECT_KNOWLEDGE.md          # This document
```

---

_Generated by Project Review Orchestrator | 2025-12-29_
_Source: https://github.com/Mnehmos/mnehmos.roo.code_
