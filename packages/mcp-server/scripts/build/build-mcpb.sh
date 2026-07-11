#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
BUILD_DIR="$ROOT_DIR/.mcpb-build"
OUTPUT="$ROOT_DIR/nebula.mcpb"

echo "Building Nebula MCP bundle..."

rm -rf "$BUILD_DIR" "$OUTPUT"
mkdir -p "$BUILD_DIR/server/apps" "$BUILD_DIR/server/contracts"

cd "$ROOT_DIR"
pnpm run build

cp "$ROOT_DIR/dist/index.js" "$BUILD_DIR/server/index.js"
cp -r "$ROOT_DIR/dist/apps/"* "$BUILD_DIR/server/apps/" 2>/dev/null || true
cp "$ROOT_DIR/dist/contracts/"*.wasm "$BUILD_DIR/server/contracts/" 2>/dev/null || true

sed -i.bak '1s|^#!/usr/bin/env node||' "$BUILD_DIR/server/index.js" 2>/dev/null || \
  sed -i '' '1s|^#!/usr/bin/env node||' "$BUILD_DIR/server/index.js"
rm -f "$BUILD_DIR/server/index.js.bak"

echo "Installing production dependencies..."
cp "$ROOT_DIR/package.json" "$BUILD_DIR/server/package.json"
node -e "
const fs=require('fs');
const pkg=JSON.parse(fs.readFileSync('$BUILD_DIR/server/package.json','utf8'));
delete pkg.devDependencies;
delete pkg.scripts;
fs.writeFileSync('$BUILD_DIR/server/package.json', JSON.stringify(pkg,null,2));
"
cd "$BUILD_DIR/server"
npm install --omit=dev --ignore-scripts --legacy-peer-deps
rm -f package.json package-lock.json

find node_modules -name '*.map' -delete 2>/dev/null || true

cp "$ROOT_DIR/manifest.json" "$BUILD_DIR/manifest.json"
if [ -f "$ROOT_DIR/assets/nebula-icon.svg" ]; then
  cp "$ROOT_DIR/assets/nebula-icon.svg" "$BUILD_DIR/nebula-icon.svg"
fi

cd "$BUILD_DIR"
zip -r "$OUTPUT" . -x '*.DS_Store' > /dev/null

rm -rf "$BUILD_DIR"
SIZE=$(du -h "$OUTPUT" | cut -f1)
echo ""
echo "Done! Created: $OUTPUT ($SIZE)"
echo ""
echo "Install in Claude Desktop:"
echo "  - Double-click nebula.mcpb"
echo "  - Or drag into Claude Desktop MCP settings"
