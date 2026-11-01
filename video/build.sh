#!/bin/bash
# 一键重做宣传片（第二版）：逐帧渲染 → 合成配乐 → 压成 mp4。在仓库根目录运行。
# JOBS=2 bash video/build.sh 可以用两个浏览器并行渲染（四核机器上大约快一半）。
set -e
cd "$(dirname "$0")/.."
python3 video/render.py --jobs "${JOBS:-1}"
python3 video/score.py
ffmpeg -loglevel error -y -framerate 24 -i video/build/frames/%05d.jpg -i video/build/score.wav \
  -vf "hqdn3d=2:1.5:4:3,format=yuv420p" -c:v libx264 -preset slow -crf 24 -movflags +faststart \
  -c:a aac -b:a 160k -shortest video/trailer.mp4
echo "video/trailer.mp4"
