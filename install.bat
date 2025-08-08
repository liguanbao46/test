@echo off
echo 文件格式转换器 - 安装脚本
echo ==============================

echo 正在检查Python环境...
python --version >nul 2>&1
if errorlevel 1 (
    echo 错误：未找到Python，请先安装Python 3.7或更高版本
    echo 下载地址：https://www.python.org/downloads/
    pause
    exit /b 1
)

echo Python环境检查通过！

echo 正在安装依赖包...
pip install -r requirements.txt

if errorlevel 1 (
    echo 依赖安装失败，请检查网络连接或手动安装
    pause
    exit /b 1
)

echo.
echo 安装完成！
echo.
echo 使用方法：
echo 1. 双击运行 run.bat 启动程序
echo 2. 或者在命令行中运行：python file_converter.py
echo.
echo 注意：
echo 1. 音频和视频转换功能需要额外安装FFmpeg
echo    下载地址：https://ffmpeg.org/download.html
echo 2. 高级文档转换功能需要额外安装Pandoc
echo    下载地址：https://pandoc.org/installing.html
echo.
pause