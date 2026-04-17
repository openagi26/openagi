#!/usr/bin/env bash
# browser_test_daemon.sh — OpenAGI T1 自守护测试脚本（D1 升级版）
# 每 10 分钟自动跑一次 browser_test_runner.py，循环直到进度跑完 100 键
# D1 升级：每轮结束后调用 daemon_auto_fix.py，自动分类 FAIL 并修正 test_plan
#
# 用法：
#   nohup bash /Users/mc/AI/openagi/scripts/browser_test_daemon.sh > /tmp/browser_test_daemon.log 2>&1 &
#   echo $! > /tmp/browser_test_daemon.pid
#
# 停止：
#   kill $(cat /tmp/browser_test_daemon.pid)

set -uo pipefail   # 去掉 -e，让 runner 非零退出时 daemon 能继续（自愈）

PROJECT_ROOT="/Users/mc/AI/openagi"
RUNNER="${PROJECT_ROOT}/scripts/browser_test_runner.py"
AUTO_FIX="${PROJECT_ROOT}/scripts/daemon_auto_fix.py"
LOG_DIR="${PROJECT_ROOT}/docs/test-runs"
PID_FILE="/tmp/browser_test_daemon.pid"
INTERVAL=600   # 10 分钟（秒）
BATCH_SIZE=10  # 每次跑 10 键
RETRY_WAIT=60  # runner 失败后等待重试的秒数

# 写入自己的 PID
echo $$ > "$PID_FILE"
echo "[daemon] 启动 PID=$$ 时间=$(date '+%Y-%m-%d %H:%M:%S')"
echo "[daemon] 每 ${INTERVAL}s 跑一批 ${BATCH_SIZE} 键"
echo "[daemon] 停止：kill \$(cat ${PID_FILE})"

# 状态追踪文件
STATE_FILE="${LOG_DIR}/daemon_state.json"

# 初始化状态（若不存在）
if [[ ! -f "$STATE_FILE" ]]; then
    python3 -c "
import json
state = {'next_start': 11, 'total_keys': 100, 'completed': 10, 'rounds': 0}
with open('${STATE_FILE}', 'w') as f:
    json.dump(state, f, indent=2)
print('[daemon] 初始化状态文件，从 tc_P1_011 开始')
"
fi

round=0
while true; do
    round=$((round + 1))
    now=$(date '+%Y-%m-%d %H:%M:%S')

    # 读取状态
    STATE=$(python3 -c "
import json
with open('${STATE_FILE}') as f:
    s = json.load(f)
print(s['next_start'], s['total_keys'], s['completed'])
")
    read -r next_start total_keys completed <<< "$STATE"

    # 计算本轮 end
    next_end=$((next_start + BATCH_SIZE - 1))
    if [[ $next_end -gt $total_keys ]]; then
        next_end=$total_keys
    fi

    echo ""
    echo "============================================================"
    echo "[daemon] 第 ${round} 轮 | ${now}"
    echo "[daemon] 运行批次: tc_P1_${next_start} ~ tc_P1_${next_end}"
    echo "============================================================"

    # ── 检查后端健康（不尝试重启，只等）──────────────────────────────────
    HEALTH_STATUS=$(python3 -c "
import urllib.request, sys
try:
    r = urllib.request.urlopen('http://127.0.0.1:8888/health', timeout=5)
    print('ok')
except Exception as e:
    print('down')
" 2>/dev/null)
    if [[ "$HEALTH_STATUS" != "ok" ]]; then
        echo "[daemon] 后端 /health 不可达，等待 ${RETRY_WAIT}s 后重试（不尝试重启后端）"
        sleep "$RETRY_WAIT"
        continue
    fi

    # ── 运行测试 ──────────────────────────────────────────────────────────
    RUNNER_OK=0
    if python3 "$RUNNER" --start "$next_start" --end "$next_end"; then
        RUNNER_OK=1
    else
        echo "[daemon] ⚠ runner 退出非零，等待 ${RETRY_WAIT}s 后重试相同批次"
        sleep "$RETRY_WAIT"
        # 不更新状态，下轮重试同一批次
    fi

    if [[ $RUNNER_OK -eq 1 ]]; then
        batch_done=$((next_end - next_start + 1))
        new_completed=$((completed + batch_done))
        new_next=$((next_end + 1))

        # 更新状态
        python3 -c "
import json
with open('${STATE_FILE}') as f:
    s = json.load(f)
s['next_start'] = ${new_next}
s['completed']  = ${new_completed}
s['rounds']     = s.get('rounds', 0) + 1
s['last_run']   = '${now}'
with open('${STATE_FILE}', 'w') as f:
    json.dump(s, f, indent=2)
"
        echo "[daemon] 本轮完成，已完成 ${new_completed}/${total_keys} 键"

        # ── D1 升级：每轮结束后自动修复 FAIL ──────────────────────────────
        echo "[daemon] 调用 daemon_auto_fix.py 分类 FAIL..."
        if python3 "$AUTO_FIX"; then
            echo "[daemon] auto_fix 完成"
        else
            echo "[daemon] auto_fix 出错，继续下一轮（不中断）"
        fi

        # 若所有键完成，重置从头再跑（持续监控）
        if [[ $new_next -gt $total_keys ]]; then
            echo "[daemon] 所有 ${total_keys} 键测试完成！重置状态，从头循环监控..."
            python3 -c "
import json
with open('${STATE_FILE}') as f:
    s = json.load(f)
s['next_start'] = 1
s['completed']  = 0
with open('${STATE_FILE}', 'w') as f:
    json.dump(s, f, indent=2)
"
        fi

        echo "[daemon] 下轮将在 ${INTERVAL}s 后启动..."
        sleep "$INTERVAL"
    fi
done
