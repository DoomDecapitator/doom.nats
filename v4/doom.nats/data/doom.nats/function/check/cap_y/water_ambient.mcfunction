# doom.nats:check/cap_y/water_ambient —— 作者层：按 Y 段覆盖该类容量（rules/counts.json capByY.water_ambient）
# 由 check/cap 在比较前调用（$cap.now 已初始化为引擎快照算出的 $cap.water_ambient；后面命中的段**依次覆盖**）。

