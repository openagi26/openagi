#!/usr/bin/env bash
# screencapture_archive.sh <test_id> <verdict>
# verdict: PASS | FAIL
set -euo pipefail

TEST_ID="${1:?Usage: $0 <test_id> <verdict>}"
VERDICT="${2:?Usage: $0 <test_id> <verdict>}"
[[ "$VERDICT" == "PASS" || "$VERDICT" == "FAIL" ]] || { echo "verdict must be PASS or FAIL"; exit 1; }

BASE_DIR="/Users/mc/AI/openagi/docs/test-runs"
DATE=$(date +%Y%m%d)

# 找到或创建当日 runNNN 目录
RUN_DIR=$(ls -d "${BASE_DIR}/${DATE}_run"* 2>/dev/null | sort | tail -1)
if [[ -z "$RUN_DIR" ]]; then
  RUN_DIR="${BASE_DIR}/${DATE}_run001"
  mkdir -p "$RUN_DIR"
else
  RUN_DIR="$RUN_DIR"  # 复用最新 run
fi
mkdir -p "$RUN_DIR"

# 计算自增序号（基于已有 png 文件数）
SEQ=$(printf "%03d" $(( $(ls "$RUN_DIR"/*.png 2>/dev/null | wc -l) + 1 )))
FILENAME="${SEQ}_${TEST_ID}_${VERDICT}.png"
FILEPATH="${RUN_DIR}/${FILENAME}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# 截图：优先截 Chrome 窗口，降级截整屏
CHROME_WIN_ID=$(osascript -e 'tell application "Google Chrome" to get id of window 1' 2>/dev/null || echo "")
if [[ -n "$CHROME_WIN_ID" ]]; then
  screencapture -x -l "$CHROME_WIN_ID" "$FILEPATH" 2>/dev/null || screencapture -x "$FILEPATH"
else
  # 降级：截整屏（Chrome 未运行或权限不足）
  screencapture -x "$FILEPATH"
fi

# SHA256 哈希
SHA256=$(shasum -a 256 "$FILEPATH" | awk '{print $1}')

# 分辨率（取第一个显示器）
RESOLUTION=$(system_profiler SPDisplaysDataType 2>/dev/null \
  | awk '/Resolution/{print $2"x"$4; exit}' || echo "unknown")

# 写入 manifest.jsonl
MANIFEST="${RUN_DIR}/manifest.jsonl"
printf '{"seq":"%s","test_id":"%s","verdict":"%s","timestamp":"%s","screenshot_sha256":"%s","screen_resolution":"%s","file":"%s"}\n' \
  "$SEQ" "$TEST_ID" "$VERDICT" "$TIMESTAMP" "$SHA256" "$RESOLUTION" "$FILENAME" >> "$MANIFEST"

echo "OK seq=${SEQ} verdict=${VERDICT} sha256=${SHA256} file=${FILEPATH}"
