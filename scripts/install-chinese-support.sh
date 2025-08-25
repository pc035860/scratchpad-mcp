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

# Create symlink for jieba dictionaries (required for jieba_query)
echo "🔗 Creating dictionary symlink..."
if [[ -L "./dict" ]]; then
    echo "   Removing existing symlink..."
    rm ./dict
fi

ln -sf extensions/dict ./dict

if [[ ! -L "./dict" ]]; then
    echo "❌ Failed to create dictionary symlink"
    exit 1
fi

echo "✅ Chinese tokenizer support installed successfully!"
echo ""
echo "🧪 Verifying jieba functionality..."

# Quick verification test (requires Node.js)
if command -v node >/dev/null 2>&1; then
    cat > verify_jieba.js << EOF
const Database = require('better-sqlite3');
try {
    const db = new Database(':memory:');
    db.loadExtension('./extensions/$EXT_FILE');
    db.exec('CREATE VIRTUAL TABLE test_fts USING fts5(content, tokenize="simple")');
    const result = db.prepare("SELECT simple_query('测试') as result").get();
    console.log('   ✅ Extension loads successfully');
    
    // Test jieba query (will fail gracefully if dictionaries not found)
    try {
        const jiebaResult = db.prepare("SELECT jieba_query('测试分词') as result").get();
        console.log('   ✅ Jieba tokenization working');
    } catch(e) {
        console.log('   ⚠️  Jieba needs dictionary symlink (run from project root)');
    }
    db.close();
} catch(e) {
    console.log('   ⚠️  Manual verification needed (SQLite extension test failed)');
}
EOF
    node verify_jieba.js 2>/dev/null
    rm verify_jieba.js
else
    echo "   ⚠️  Node.js not found, skipping verification"
fi

echo ""
echo "📁 Installed files:"
echo "   - extensions/$EXT_FILE (SQLite extension)"
echo "   - extensions/dict/ (Chinese dictionaries)"
echo "   - ./dict -> extensions/dict (symlink for jieba)"
echo ""
echo "🧠 Features enabled:"
echo "   - Smart jieba tokenization for Chinese text"
echo "   - Automatic mode selection (Chinese -> jieba, others -> simple/FTS5)"
echo "   - Multi-tier fallback: jieba -> simple -> FTS5 -> LIKE"
echo ""
echo "🔍 Example searches:"
echo "   - Auto jieba: '自然語言處理' or '機器學習'"
echo "   - Manual control: useJieba: true/false in API"
echo ""
echo "🚀 Start the MCP server with: npm run dev"