#!/bin/bash
# 批量抠图脚本 - 使用 Remove.bg API

API_KEY="YOUR_API_KEY"
INPUT_DIR="/Users/moonshot/.openclaw/workspace/flavor-ai-lab-v1/images"
OUTPUT_DIR="/Users/moonshot/.openclaw/workspace/flavor-ai-lab-v1/images-transparent"

# 创建输出目录
mkdir -p "$OUTPUT_DIR"

# 饮料图片列表
DRINKS=(
  "yanmai-kekou.jpg:燕麦可可"
  "moli-tangli.jpg:茉莉汤力"
  "nuanjiang-hongcha.jpg:暖姜红茶"
  "qingju-rusuan.jpg:青桔乳酸"
  "qingka-tangli.jpg:轻咖汤力"
  "qingyou-wulong.jpg:青柚乌龙"
  "chixia-xuecheng.jpg:赤霞血橙"
  "haiyan-baitao.jpg:海盐白桃"
  "songzhen-qingmei.jpg:松针青梅"
  "xuanmi-ningmeng.jpg:玄米柠檬"
  "yeqing-lizhi.jpg:椰青荔枝"
  "zisu-huamei.jpg:紫苏话梅"
)

for item in "${DRINKS[@]}"; do
  IFS=':' read -r filename name <<< "$item"
  input_file="$INPUT_DIR/$filename"
  output_file="$OUTPUT_DIR/${filename%.jpg}.png"
  
  if [ -f "$input_file" ]; then
    echo "Processing: $name ($filename)"
    
    curl -s -X POST https://api.remove.bg/v1.0/removebg \
      -H "X-Api-Key: $API_KEY" \
      -F "image_file=@$input_file" \
      -F "size=auto" \
      -o "$output_file"
    
    if [ $? -eq 0 ] && [ -s "$output_file" ]; then
      echo "✓ Success: $output_file"
    else
      echo "✗ Failed: $filename"
    fi
  else
    echo "✗ Not found: $input_file"
  fi
  
  # 限速：每秒1个请求
  sleep 1
done

echo "Done! Transparent images saved to $OUTPUT_DIR"
