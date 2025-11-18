#!/usr/bin/bash
set -euo pipefail

# Download latest static ffmpeg build (includes libvmaf)
URL="https://johnvansickle.com/ffmpeg/builds/ffmpeg-git-amd64-static.tar.xz"
TAR="ffmpeg-git-amd64-static.tar.xz"

echo "Downloading static ffmpeg ..."
rm -f "$TAR"
wget -q --show-progress "$URL" -O "$TAR"

echo "Extracting ..."
rm -rf ffmpeg-git-*-amd64-static || true
tar xf "$TAR"

# Locate extracted directory (e.g., ffmpeg-git-20250927-amd64-static)
EXTRACT_DIR=$(find . -maxdepth 1 -type d -name 'ffmpeg-git-*-amd64-static' | head -n 1)
if [ -z "${EXTRACT_DIR:-}" ]; then
  echo "Could not find extracted ffmpeg directory." >&2
  exit 1
fi

DEST_DIR="/opt/ffmpeg/ffmpeg-static"
echo "Installing to $DEST_DIR (requires sudo) ..."
sudo mkdir -p "/opt/ffmpeg"
sudo rm -rf "$DEST_DIR"
sudo mv "$EXTRACT_DIR" "$DEST_DIR"

echo "Cleaning up archive ..."
rm -f "$TAR"

echo
echo "Done. Add this to your ~/.bashrc (or ~/.zshrc):"
echo "  export PATH=\"$DEST_DIR:\$PATH\""
echo
echo "Then reload your shell:"
echo "  source ~/.bashrc"
echo
echo "Verify libvmaf is available:"
echo "  ffmpeg -hide_banner -filters | grep -i vmaf || true"
