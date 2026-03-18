#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# FloraIQ Remotion Video — Render, Compress & Generate Poster
# ─────────────────────────────────────────────────────────────
# Usage:  chmod +x scripts/render-video.sh && ./scripts/render-video.sh
# Prereqs: remotion, ffmpeg (brew install ffmpeg)
# ─────────────────────────────────────────────────────────────

set -e

OUT_DIR="public/videos"
ENTRY="src/remotion/Root.tsx"
COMP="ProductDemo"

mkdir -p "$OUT_DIR"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  FloraIQ Promo Video — Render Pipeline"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Step 1: Render MP4 (H.264) ──────────────────────────────
echo ""
echo "▸ [1/4] Rendering MP4..."
npx remotion render "$ENTRY" "$COMP" "$OUT_DIR/floraiq-promo-raw.mp4" \
  --codec=h264 \
  --image-format=jpeg \
  --jpeg-quality=90

# ── Step 2: Compress MP4 with ffmpeg ────────────────────────
echo ""
echo "▸ [2/4] Compressing MP4 (CRF 23, slow preset)..."
if command -v ffmpeg &> /dev/null; then
  ffmpeg -y -i "$OUT_DIR/floraiq-promo-raw.mp4" \
    -c:v libx264 \
    -crf 23 \
    -preset slow \
    -movflags +faststart \
    -an \
    "$OUT_DIR/floraiq-promo.mp4"
  
  # Show size comparison
  RAW_SIZE=$(du -h "$OUT_DIR/floraiq-promo-raw.mp4" | cut -f1)
  COMP_SIZE=$(du -h "$OUT_DIR/floraiq-promo.mp4" | cut -f1)
  echo "  Raw: $RAW_SIZE → Compressed: $COMP_SIZE"
  
  # Clean up raw
  rm "$OUT_DIR/floraiq-promo-raw.mp4"
else
  echo "  ⚠ ffmpeg not found — using raw MP4 (install: brew install ffmpeg)"
  mv "$OUT_DIR/floraiq-promo-raw.mp4" "$OUT_DIR/floraiq-promo.mp4"
fi

# ── Step 3: Render WebM (VP8 — smaller, modern browsers) ───
echo ""
echo "▸ [3/4] Rendering WebM..."
npx remotion render "$ENTRY" "$COMP" "$OUT_DIR/floraiq-promo.webm" \
  --codec=vp8

# ── Step 4: Extract poster frame ───────────────────────────
echo ""
echo "▸ [4/4] Generating poster image..."
if command -v ffmpeg &> /dev/null; then
  # Grab frame at 1 second (dashboard scene with stats visible)
  ffmpeg -y -i "$OUT_DIR/floraiq-promo.mp4" \
    -ss 00:00:01 \
    -vframes 1 \
    -q:v 2 \
    "$OUT_DIR/floraiq-poster.jpg"
  echo "  Poster: $OUT_DIR/floraiq-poster.jpg"
else
  echo "  ⚠ ffmpeg not found — skipping poster (install: brew install ffmpeg)"
fi

# ── Summary ─────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Done! Output files:"
echo ""
ls -lh "$OUT_DIR"/floraiq-* 2>/dev/null | awk '{print "  " $5 "\t" $9}'
echo ""
echo "  Video component: src/components/marketing/VideoShowcaseRemotion.tsx"
echo "  Uses <source> with WebM (primary) + MP4 (fallback)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
