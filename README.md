# Template Doctor

An Azure Developer CLI template analysis and healing agent. This tool analyzes GitHub repositories that contain Azure Developer CLI (azd) templates to ensure they follow best practices and meet compliance requirements.

## Features

- Checks for required files and folders
- Validates workflow files
- Ensures proper documentation is present
- Checks README.md for required sections and content
- Analyzes Bicep files for required resources
- Verifies azure.yaml configuration
- Generates comprehensive compliance reports
- Provides visual dashboard for compliance status

## Installation

```bash
# Clone the repository
git clone https://github.com/your-username/template-doctor.git
cd template-doctor

# Install dependencies
npm install

# Build the project
npm run build

# Link the CLI for global usage (optional)
npm link
```

## Usage

```bash
# Analyze a GitHub repository
template-doctor --repo=https://github.com/username/repo

# Analyze and serve the dashboard on localhost
template-doctor --repo=https://github.com/username/repo --serve

# Analyze and automatically open the dashboard in a browser
template-doctor --repo=https://github.com/username/repo --open-dashboard

# Specify a custom port for the dashboard server
template-doctor --repo=https://github.com/username/repo --serve --port=8080
```

## Output

The tool generates two files in the `results` directory:

1. A JSON report with detailed analysis results
2. An HTML dashboard visualizing the compliance status

## Dashboard

The dashboard provides a modern visualization of the compliance status:

- **Compliance Overview**: Shows overall compliance percentage
- **Issues**: Lists all compliance issues with details on how to fix
- **Passed Checks**: Shows all checks that passed with additional details
- **Quick Fix**: Button to open the repository in vscode.dev for quick fixes

## Development

```bash
# Run the tool in development mode
npm run build && npm start -- --repo=https://github.com/username/repo

# Adding new compliance rules
# Modify src/config/dod-rules.ts to add new rules
```

## License

MIT
