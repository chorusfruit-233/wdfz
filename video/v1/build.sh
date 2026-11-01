#!/bin/bash
# 一键重做宣传片：逐帧渲染 → 合成配乐 → 压成 mp4（在仓库根目录运行）
set -e
cd "$(dirname "$0")/../.."
python3 video/v1/render.py
python3 video/v1/score.py
ffmpeg -loglevel error -y -framerate 24 -i video/v1/build/frames/%05d.jpg -i video/v1/build/score.wav \
  -vf "hqdn3d=2:1.5:4:3,format=yuv420p" -c:v libx264 -preset slow -crf 25 -movflags +faststart \
  -c:a aac -b:a 160k -shortest video/v1/trailer.mp4
echo "video/v1/trailer.mp4"
