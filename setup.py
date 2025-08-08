from setuptools import setup, find_packages

setup(
    name="file-converter",
    version="1.0.0",
    description="一个多格式文件转换器，支持图片、音频、视频和文档格式转换",
    author="File Converter",
    packages=find_packages(),
    install_requires=[
        "python-magic",
        "python-magic-bin",
        "Pillow>=9.0.0",
        "pandas>=1.3.0",
        "python-docx>=0.8.11",
        "openpyxl>=3.0.9",
        "python-pptx>=0.6.21",
        "pypandoc>=1.5",
        "xlwt>=1.3.0",
    ],
    entry_points={
        'console_scripts': [
            'file-converter=file_converter:main',
        ],
    },
    python_requires='>=3.7',
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: Microsoft :: Windows",
        "Development Status :: 4 - Beta",
        "Intended Audience :: End Users/Desktop",
        "Topic :: Multimedia :: Graphics :: Graphics Conversion",
        "Topic :: Multimedia :: Sound/Audio :: Conversion",
        "Topic :: Multimedia :: Video :: Conversion",
    ],
)