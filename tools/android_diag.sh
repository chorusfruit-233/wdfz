#!/usr/bin/env bash
# 安卓模拟器诊断（.github/workflows/android-diag.yml 在 reactivecircus/android-emulator-runner 里调用）：
# 装上 x86_64 诊断版 APK，带 --es query diag=1 启动；页面自动跑诊断路线，每到一站在系统日志（标签 WDFZ）里打「SHOT 名字」，
# 这里按这个时机截屏；看到「SHOT menu」时点两下屏幕（测试点击以后有没有声音）；看到「DONE」或超时就收尾。
# 产物：$OUT/*.png（截屏）、$OUT/wdfz.log（页面的报告）、$OUT/logcat.txt（Gecko、音频相关的系统日志）
set -u
APK="$1"; OUT="${2:-diag-out}"; mkdir -p "$OUT"
adb wait-for-device
adb install -r -g "$APK" || exit 1
adb logcat -c
adb shell settings put system accelerometer_rotation 0 || true
adb shell am start -n io.github.wdfz.lishijie/.MainActivity --es query diag=1
read -r NW NH < <(adb shell wm size | grep -o '[0-9]*x[0-9]*' | tail -1 | tr x ' ')
W=$(( NW > NH ? NW : NH )); H=$(( NW > NH ? NH : NW ))
adb exec-out screencap -p > "$OUT/00_splash_2s.png"; sleep 3
adb exec-out screencap -p > "$OUT/01_splash_5s.png"; sleep 4
adb exec-out screencap -p > "$OUT/02_splash_9s.png"
seen=" "; n=10
for i in $(seq 1 600); do
  sleep 1
  adb logcat -d -s WDFZ:I > "$OUT/wdfz.log" 2>/dev/null
  for name in $(grep -o 'SHOT [a-z0-9_]*' "$OUT/wdfz.log" | awk '{print $2}'); do
    case "$seen" in *" $name "*) continue;; esac
    seen="$seen$name "
    adb exec-out screencap -p > "$OUT/${n}_${name}.png"; n=$((n+1))
    if [ "$name" = menu ]; then
      adb shell input tap $((W*88/100)) $((H/2)); sleep 3; adb shell input tap $((W*88/100)) $((H/2))
    fi
  done
  grep -q 'DONE' "$OUT/wdfz.log" && break
done
adb exec-out screencap -p > "$OUT/99_final.png"
adb logcat -d > "$OUT/logcat-all.txt"
grep -E "GeckoConsole|WDFZ|cubeb|AudioTrack|AAudio|audio|Audio|GeckoView|Gecko|WebGL|FATAL|AndroidRuntime|ActivityManager: .*lishijie" "$OUT/logcat-all.txt" | grep -v "^--------- beginning" | tail -1500 > "$OUT/logcat.txt"
rm -f "$OUT/logcat-all.txt"
echo "===== WDFZ ====="; cut -c1-400 "$OUT/wdfz.log" | tail -80
echo "===== 截屏 ====="; ls -la "$OUT"
