#!/bin/bash
set -e

echo "=== Installing global npm packages ==="
npm install -g @sap/cds-dk @ui5/cli mbt --silent
echo "  → @sap/cds-dk, @ui5/cli, mbt installed"

echo "=== Installing project dependencies ==="
# Root CAP dependencies
npm install --silent
echo "  → CAP dependencies installed"

# UI5 app dependencies
cd app/findmyexpert
npm install --silent
echo "  → UI5 dependencies installed"
cd ../..

echo "=== Seeding SQLite database ==="
npx cds deploy --to sqlite 2>/dev/null && echo "  → SQLite DB seeded" || echo "  ⚠️  cds deploy failed — run manually: npx cds deploy --to sqlite"

echo "=== Installing Cline MCP settings ==="
CLINE_SETTINGS_DIR="$HOME/.vscode-server/data/User/globalStorage/saoudrizwan.claude-dev/settings"
mkdir -p "$CLINE_SETTINGS_DIR"
if [ ! -s "$CLINE_SETTINGS_DIR/cline_mcp_settings.json" ]; then
  cp .devcontainer/cline_mcp_settings.json "$CLINE_SETTINGS_DIR/cline_mcp_settings.json"
  echo "  → MCP settings installed"
else
  echo "  → MCP settings already exist, skipping"
fi

echo ""
echo "=== Setup complete ==="
echo "   Start CAP:  npm run watch           → http://localhost:4004"
echo "   Start UI5:  cd app/findmyexpert && npm run start:sandbox  → http://localhost:8080/sandbox.html"
echo "   Open FLP:   http://localhost:8080/sandbox.html"
