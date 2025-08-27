#!/usr/bin/env bash
set -euo pipefail

echo "🇨🇳 Installing Chinese tokenizer support..."

# Always run from repo root
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# Requirements checks
command -v curl >/dev/null 2>&1 || { echo "❌ curl not found"; exit 1; }
command -v unzip >/dev/null 2>&1 || { echo "❌ unzip not found. Please install unzip and retry"; exit 1; }

# Prepare directories
mkdir -p extensions

OS_NAME="$(uname -s)"    # Darwin / Linux
ARCH_NAME="$(uname -m)"  # arm64 / x86_64 / aarch64

EXT="so"
ASSET_URL=""

if [[ "$OS_NAME" == "Darwin" ]]; then
  EXT="dylib"
  echo "🖥 Detected macOS ($ARCH_NAME)"
  # Per user decision: on Apple Silicon, use x64 build via Rosetta
  ASSET_URL="https://github.com/wangfenjin/simple/releases/download/v0.5.2/libsimple-osx-x64.zip"
  if [[ "$ARCH_NAME" == "arm64" ]]; then
    echo "   ⚠️ Using x64 build on Apple Silicon (requires Rosetta and compatible x64 Node/better-sqlite3)"
  fi
elif [[ "$OS_NAME" == "Linux" ]]; then
  echo "🐧 Detected Linux ($ARCH_NAME)"
  if [[ "$ARCH_NAME" == "aarch64" || "$ARCH_NAME" == "arm64" || "$ARCH_NAME" == arm* ]]; then
    ASSET_URL="https://github.com/wangfenjin/simple/releases/download/v0.5.2/libsimple-linux-ubuntu-24.04-arm.zip"
  else
    ASSET_URL="https://github.com/wangfenjin/simple/releases/download/v0.5.2/libsimple-linux-ubuntu-latest.zip"
  fi
else
  echo "❌ Unsupported platform: $OS_NAME ($ARCH_NAME)"
  echo "   Supported: macOS, Linux"
  exit 1
fi

echo "📦 Downloading binary asset..."
TMP_ZIP="extensions/libsimple.tmp.zip"
rm -f "$TMP_ZIP"

if ! curl -fL --retry 3 --connect-timeout 15 "$ASSET_URL" -o "$TMP_ZIP"; then
  echo "❌ Download failed: $ASSET_URL"
  # Linux x86_64 fallback
  if [[ "$OS_NAME" == "Linux" && "$ARCH_NAME" == "x86_64" ]]; then
    ASSET_URL_FALLBACK="https://github.com/wangfenjin/simple/releases/download/v0.5.2/libsimple-linux-ubuntu-22.04.zip"
    echo "   ↻ Trying fallback asset: $ASSET_URL_FALLBACK"
    curl -fL --retry 3 --connect-timeout 15 "$ASSET_URL_FALLBACK" -o "$TMP_ZIP"
  else
    exit 1
  fi
fi

echo "📦 Unzipping into extensions/"
unzip -oq "$TMP_ZIP" -d extensions/
rm -f "$TMP_ZIP"

# Find library and normalize filename
echo "🔎 Locating extension library..."
FOUND_LIB=""
while IFS= read -r p; do
  FOUND_LIB="$p"
  break
done < <(find extensions -maxdepth 3 -type f \( -name "libsimple*.${EXT}" -o -name "simple*.${EXT}" \) 2>/dev/null | head -n 1)

if [[ -z "${FOUND_LIB}" ]]; then
  echo "❌ libsimple.${EXT} not found after unzip"
  exit 1
fi

cp -f "$FOUND_LIB" "extensions/libsimple.${EXT}"

# macOS: remove quarantine to allow loading
if [[ "$OS_NAME" == "Darwin" ]]; then
  command -v xattr >/dev/null 2>&1 && xattr -dr com.apple.quarantine "extensions/libsimple.${EXT}" || true
fi

# Try to prepare jieba dictionaries if available
echo "📚 Checking jieba dictionaries..."
if [[ ! -d "extensions/dict" ]]; then
  # Find dict directory in extracted files and copy to standard location
  FOUND_DICT=""
  while IFS= read -r d; do
    FOUND_DICT="$d"
    break
  done < <(find extensions -maxdepth 3 -type d -name "dict" 2>/dev/null | head -n 1)
  if [[ -n "$FOUND_DICT" && "$FOUND_DICT" != "extensions/dict" ]]; then
    cp -R "$FOUND_DICT" extensions/dict
  fi
fi

# Create dict symlink at repo root (required by jieba_query)
if [[ -d "extensions/dict" ]]; then
  echo "🔗 Create symlink ./dict -> extensions/dict"
  ln -sfn extensions/dict ./dict
else
  echo "ℹ️ No dictionary found. Will use simple tokenizer only"
fi

# If dist exists, create dist/extensions -> ../extensions for runtime loading
if [[ -d "dist" ]]; then
  echo "🔗 Create symlink dist/extensions -> ../extensions (for dist runtime)"
  ln -sfn ../extensions dist/extensions
fi

echo "✅ Installation files ready"

# 非致命驗證：嘗試以 Node 載入擴展（若有 better-sqlite3）
echo "🧪 Verification (non-fatal)..."
if command -v node >/dev/null 2>&1; then
  set +e
  node - <<'NODE'
(function(){
  try {
    let Database;
    try { Database = require('better-sqlite3'); } catch (e) {
      console.log('   ℹ️  Skip verification: better-sqlite3 not installed');
      return;
    }
    const os = process.platform;
    const ext = os === 'darwin' ? 'dylib' : 'so';
    const DatabaseCtor = Database;
    const db = new DatabaseCtor(':memory:');
    db.loadExtension('./extensions/libsimple.' + ext);
    db.exec('CREATE VIRTUAL TABLE t USING fts5(c, tokenize="simple")');
    db.prepare("SELECT simple_query('測試')").get();
    try { db.prepare("SELECT jieba_query('中文測試')").get(); console.log('   ✅ Jieba tokenization available'); } catch { console.log('   ℹ️  Jieba dictionary not detected. Will use simple_query'); }
    db.close();
    console.log('   ✅ Extension loaded and simple tokenizer available');
  } catch (e) {
    console.log('   ⚠️  Verification skipped/failed: ' + (e && e.message ? e.message : e));
  }
})();
NODE
  set -e
else
  echo "   ℹ️ Node.js not found; skipping verification"
fi

echo ""
echo "📁 Installed items:"
echo "   - extensions/libsimple.${EXT} (SQLite extension)"
if [[ -d "extensions/dict" ]]; then
  echo "   - extensions/dict/ (Chinese dictionaries)"
  echo "   - ./dict -> extensions/dict (symlink)"
fi
if [[ -L "dist/extensions" ]]; then
  echo "   - dist/extensions -> ../extensions (symlink for dist runtime)"
fi

echo ""
echo "🧠 Features:"
echo "   - Chinese simple tokenizer (required)"
echo "   - Jieba tokenizer (if dictionary exists)"
echo "   - Fallback chain: jieba -> simple -> FTS5 -> LIKE"

echo ""
echo "🚀 Start MCP server: npm run dev"