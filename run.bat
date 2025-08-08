@echo off
echo 启动文件格式转换器...
python file_converter.py
if errorlevel 1 (
    echo.
    echo 程序运行出错，请检查：
    echo 1. 是否已正确安装Python
    echo 2. 是否已安装所需依赖包（运行install.bat）
    echo 3. 文件路径是否正确
    echo.
    pause
)