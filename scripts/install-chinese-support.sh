#!/bin/bash
set -e

echo "🇨🇳 Installing Chinese tokenizer support..."

# Create extensions directory
mkdir -p extensions

# Detect platform
if [[ "$OSTYPE" == "darwin"* ]]; then
    PLATFORM="darwin"
    EXT_FILE="libsimple.dylib"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    PLATFORM="linux" 
    EXT_FILE="libsimple.so"
else
    echo "❌ Unsupported platform: $OSTYPE"
    echo "   Supported platforms: macOS (darwin), Linux (linux-gnu)"
    exit 1
fi

echo "📦 Downloading extension for $PLATFORM..."

# Download extension file
curl -L "https://github.com/wangfenjin/simple/releases/download/v0.5.2/$EXT_FILE" \
     -o "extensions/$EXT_FILE"

if [[ ! -f "extensions/$EXT_FILE" ]]; then
    echo "❌ Failed to download extension file"
    exit 1
fi

# Download dictionary files
echo "📚 Downloading dictionary files..."
curl -L "https://github.com/wangfenjin/simple/releases/download/v0.5.2/dict.tar.gz" \
     | tar -xz -C extensions/

if [[ ! -d "extensions/dict" ]]; then
    echo "❌ Failed to download dictionary files"
    exit 1
fi

echo "✅ Chinese tokenizer support installed successfully!"
echo ""
echo "📁 Installed files:"
echo "   - extensions/$EXT_FILE"
echo "   - extensions/dict/ (Chinese dictionaries)"
echo ""
echo "🔍 You can now search Chinese text with improved word segmentation and Pinyin support."
echo "📖 Example searches:"
echo "   - Chinese: '周杰倫' or '自然語言處理'"
echo "   - Pinyin: 'zhoujielun' or 'ziranyuyanchuli'"
echo ""
echo "🚀 Start the MCP server with: npm run dev"