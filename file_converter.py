import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import os
import magic
from PIL import Image, ImageTk
import subprocess
from pathlib import Path
import threading
import json

class FileConverter:
    def __init__(self, root):
        self.root = root
        self.root.title("文件格式转换器")
        self.root.geometry("800x600")
        self.root.resizable(True, True)
        
        # 当前文件信息
        self.current_file = None
        self.current_format = None
        
        # 支持的转换格式映射
        self.format_mappings = {
            'image': ['PNG', 'JPEG', 'GIF', 'BMP', 'TIFF', 'WEBP', 'ICO'],
            'document': ['PDF', 'DOCX', 'TXT', 'RTF', 'HTML'],
            'audio': ['MP3', 'WAV', 'FLAC', 'AAC', 'OGG'],
            'video': ['MP4', 'AVI', 'MOV', 'MKV', 'WEBM', 'FLV'],
            'archive': ['ZIP', 'RAR', '7Z', 'TAR.GZ']
        }
        
        self.setup_ui()
        
    def setup_ui(self):
        """设置用户界面"""
        # 主框架
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # 配置网格权重
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(1, weight=1)
        
        # 文件选择区域
        file_frame = ttk.LabelFrame(main_frame, text="文件选择", padding="10")
        file_frame.grid(row=0, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))
        file_frame.columnconfigure(1, weight=1)
        
        ttk.Button(file_frame, text="选择文件", command=self.select_file).grid(row=0, column=0, padx=(0, 10))
        
        self.file_path_var = tk.StringVar()
        self.file_path_entry = ttk.Entry(file_frame, textvariable=self.file_path_var, state="readonly")
        self.file_path_entry.grid(row=0, column=1, sticky=(tk.W, tk.E))
        
        # 文件信息区域
        info_frame = ttk.LabelFrame(main_frame, text="文件信息", padding="10")
        info_frame.grid(row=1, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))
        info_frame.columnconfigure(1, weight=1)
        
        ttk.Label(info_frame, text="检测到的格式:").grid(row=0, column=0, sticky=tk.W, padx=(0, 10))
        self.detected_format_var = tk.StringVar(value="未选择文件")
        ttk.Label(info_frame, textvariable=self.detected_format_var, font=("Arial", 10, "bold")).grid(row=0, column=1, sticky=tk.W)
        
        ttk.Label(info_frame, text="文件大小:").grid(row=1, column=0, sticky=tk.W, padx=(0, 10))
        self.file_size_var = tk.StringVar(value="-")
        ttk.Label(info_frame, textvariable=self.file_size_var).grid(row=1, column=1, sticky=tk.W)
        
        # 转换设置区域
        convert_frame = ttk.LabelFrame(main_frame, text="转换设置", padding="10")
        convert_frame.grid(row=2, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))
        convert_frame.columnconfigure(1, weight=1)
        
        ttk.Label(convert_frame, text="目标格式:").grid(row=0, column=0, sticky=tk.W, padx=(0, 10))
        self.target_format_var = tk.StringVar()
        self.target_format_combo = ttk.Combobox(convert_frame, textvariable=self.target_format_var, state="readonly")
        self.target_format_combo.grid(row=0, column=1, sticky=(tk.W, tk.E), padx=(0, 10))
        
        ttk.Label(convert_frame, text="输出目录:").grid(row=1, column=0, sticky=tk.W, padx=(0, 10), pady=(10, 0))
        
        output_frame = ttk.Frame(convert_frame)
        output_frame.grid(row=1, column=1, sticky=(tk.W, tk.E), pady=(10, 0))
        output_frame.columnconfigure(0, weight=1)
        
        self.output_path_var = tk.StringVar()
        self.output_path_entry = ttk.Entry(output_frame, textvariable=self.output_path_var)
        self.output_path_entry.grid(row=0, column=0, sticky=(tk.W, tk.E), padx=(0, 10))
        
        ttk.Button(output_frame, text="浏览", command=self.select_output_dir).grid(row=0, column=1)
        
        # 转换按钮
        self.convert_button = ttk.Button(convert_frame, text="开始转换", command=self.start_conversion, state="disabled")
        self.convert_button.grid(row=2, column=0, columnspan=2, pady=(20, 0))
        
        # 进度条
        self.progress_var = tk.DoubleVar()
        self.progress_bar = ttk.Progressbar(main_frame, variable=self.progress_var, maximum=100)
        self.progress_bar.grid(row=3, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))
        
        # 状态栏
        self.status_var = tk.StringVar(value="准备就绪")
        status_label = ttk.Label(main_frame, textvariable=self.status_var, relief=tk.SUNKEN, anchor=tk.W)
        status_label.grid(row=4, column=0, columnspan=2, sticky=(tk.W, tk.E))
        
    def select_file(self):
        """选择要转换的文件"""
        file_path = filedialog.askopenfilename(
            title="选择要转换的文件",
            filetypes=[
                ("所有文件", "*.*"),
                ("图片文件", "*.png *.jpg *.jpeg *.gif *.bmp *.tiff *.webp"),
                ("文档文件", "*.pdf *.docx *.txt *.rtf *.html"),
                ("音频文件", "*.mp3 *.wav *.flac *.aac *.ogg"),
                ("视频文件", "*.mp4 *.avi *.mov *.mkv *.webm *.flv"),
            ]
        )
        
        if file_path:
            self.current_file = file_path
            self.file_path_var.set(file_path)
            self.detect_file_format()
            
    def detect_file_format(self):
        """检测文件格式"""
        if not self.current_file:
            return
            
        try:
            # 获取文件信息
            file_stat = os.stat(self.current_file)
            file_size = self.format_file_size(file_stat.st_size)
            self.file_size_var.set(file_size)
            
            # 使用python-magic检测文件类型
            try:
                mime_type = magic.from_file(self.current_file, mime=True)
                file_type = magic.from_file(self.current_file)
            except:
                # 如果magic失败，使用文件扩展名
                ext = os.path.splitext(self.current_file)[1].lower()
                mime_type = self.guess_mime_type(ext)
                file_type = f"文件扩展名: {ext}"
            
            self.current_format = mime_type
            self.detected_format_var.set(f"{file_type}")
            
            # 更新可用的转换格式
            self.update_target_formats(mime_type)
            
            # 设置默认输出目录
            if not self.output_path_var.get():
                output_dir = os.path.dirname(self.current_file)
                self.output_path_var.set(output_dir)
                
            self.status_var.set("文件检测完成，请选择目标格式")
            
        except Exception as e:
            messagebox.showerror("错误", f"文件检测失败: {str(e)}")
            
    def guess_mime_type(self, ext):
        """根据文件扩展名猜测MIME类型"""
        mime_map = {
            '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
            '.gif': 'image/gif', '.bmp': 'image/bmp', '.tiff': 'image/tiff',
            '.webp': 'image/webp', '.ico': 'image/x-icon',
            '.pdf': 'application/pdf', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.txt': 'text/plain', '.rtf': 'application/rtf', '.html': 'text/html',
            '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac',
            '.aac': 'audio/aac', '.ogg': 'audio/ogg',
            '.mp4': 'video/mp4', '.avi': 'video/x-msvideo', '.mov': 'video/quicktime',
            '.mkv': 'video/x-matroska', '.webm': 'video/webm', '.flv': 'video/x-flv',
            '.zip': 'application/zip', '.rar': 'application/x-rar-compressed',
            '.7z': 'application/x-7z-compressed'
        }
        return mime_map.get(ext, 'application/octet-stream')
        
    def update_target_formats(self, mime_type):
        """根据检测到的文件类型更新可用的转换格式"""
        formats = []
        
        if mime_type.startswith('image/'):
            formats = self.format_mappings['image']
        elif mime_type.startswith('audio/'):
            formats = self.format_mappings['audio']
        elif mime_type.startswith('video/'):
            formats = self.format_mappings['video']
        elif mime_type in ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'application/rtf', 'text/html']:
            formats = self.format_mappings['document']
        elif mime_type in ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed']:
            formats = self.format_mappings['archive']
        else:
            # 默认提供一些通用格式
            formats = ['TXT', 'PDF']
            
        self.target_format_combo['values'] = formats
        if formats:
            self.target_format_combo.set(formats[0])
            self.convert_button['state'] = 'normal'
        else:
            self.convert_button['state'] = 'disabled'
            
    def select_output_dir(self):
        """选择输出目录"""
        output_dir = filedialog.askdirectory(title="选择输出目录")
        if output_dir:
            self.output_path_var.set(output_dir)
            
    def format_file_size(self, size_bytes):
        """格式化文件大小"""
        if size_bytes == 0:
            return "0 B"
        
        size_names = ["B", "KB", "MB", "GB", "TB"]
        import math
        i = int(math.floor(math.log(size_bytes, 1024)))
        p = math.pow(1024, i)
        s = round(size_bytes / p, 2)
        return f"{s} {size_names[i]}"
        
    def start_conversion(self):
        """开始转换过程"""
        if not self.current_file or not self.target_format_var.get() or not self.output_path_var.get():
            messagebox.showerror("错误", "请确保已选择文件、目标格式和输出目录")
            return
            
        # 在新线程中执行转换以避免界面冻结
        self.convert_button['state'] = 'disabled'
        self.progress_var.set(0)
        
        conversion_thread = threading.Thread(target=self.perform_conversion)
        conversion_thread.daemon = True
        conversion_thread.start()
        
    def perform_conversion(self):
        """执行实际的文件转换"""
        try:
            source_file = self.current_file
            target_format = self.target_format_var.get().lower()
            output_dir = self.output_path_var.get()
            
            # 生成输出文件名
            base_name = os.path.splitext(os.path.basename(source_file))[0]
            output_file = os.path.join(output_dir, f"{base_name}.{target_format}")
            
            self.root.after(0, lambda: self.status_var.set("正在转换..."))
            self.root.after(0, lambda: self.progress_var.set(25))
            
            # 根据文件类型选择转换方法
            if self.current_format.startswith('image/'):
                self.convert_image(source_file, output_file, target_format)
            elif self.current_format.startswith('audio/'):
                self.convert_audio(source_file, output_file, target_format)
            elif self.current_format.startswith('video/'):
                self.convert_video(source_file, output_file, target_format)
            elif self.current_format in ['application/pdf', 'text/plain', 'text/html']:
                self.convert_document(source_file, output_file, target_format)
            else:
                raise Exception(f"不支持的文件类型: {self.current_format}")
                
            self.root.after(0, lambda: self.progress_var.set(100))
            self.root.after(0, lambda: self.status_var.set("转换完成"))
            self.root.after(0, lambda: messagebox.showinfo("成功", f"文件已成功转换为: {output_file}"))
            
        except Exception as e:
            self.root.after(0, lambda: self.status_var.set("转换失败"))
            self.root.after(0, lambda: messagebox.showerror("转换错误", f"转换失败: {str(e)}"))
        finally:
            self.root.after(0, lambda: setattr(self.convert_button, 'state', 'normal'))
            
    def convert_image(self, source_file, output_file, target_format):
        """转换图片格式"""
        self.root.after(0, lambda: self.progress_var.set(50))
        
        with Image.open(source_file) as img:
            # 处理透明度
            if target_format.upper() in ['JPEG', 'JPG'] and img.mode in ('RGBA', 'LA'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = background
                
            self.root.after(0, lambda: self.progress_var.set(75))
            
            # 保存转换后的图片
            if target_format.upper() == 'JPEG':
                img.save(output_file, 'JPEG', quality=95)
            else:
                img.save(output_file, target_format.upper())
                
    def convert_audio(self, source_file, output_file, target_format):
        """转换音频格式（需要ffmpeg）"""
        self.root.after(0, lambda: self.progress_var.set(50))
        
        try:
            cmd = ['ffmpeg', '-i', source_file, '-y', output_file]
            subprocess.run(cmd, check=True, capture_output=True)
            self.root.after(0, lambda: self.progress_var.set(75))
        except subprocess.CalledProcessError as e:
            raise Exception(f"音频转换失败，请确保已安装ffmpeg: {e}")
        except FileNotFoundError:
            raise Exception("未找到ffmpeg，请先安装ffmpeg")
            
    def convert_video(self, source_file, output_file, target_format):
        """转换视频格式（需要ffmpeg）"""
        self.root.after(0, lambda: self.progress_var.set(50))
        
        try:
            cmd = ['ffmpeg', '-i', source_file, '-c:v', 'libx264', '-c:a', 'aac', '-y', output_file]
            subprocess.run(cmd, check=True, capture_output=True)
            self.root.after(0, lambda: self.progress_var.set(75))
        except subprocess.CalledProcessError as e:
            raise Exception(f"视频转换失败，请确保已安装ffmpeg: {e}")
        except FileNotFoundError:
            raise Exception("未找到ffmpeg，请先安装ffmpeg")
            
    def convert_document(self, source_file, output_file, target_format):
        """转换文档格式"""
        self.root.after(0, lambda: self.progress_var.set(50))
        
        if target_format == 'txt':
            # 简单的文本转换
            with open(source_file, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(content)
        elif target_format == 'pdf':
            # 需要额外的库来转换为PDF
            raise Exception("PDF转换功能需要额外配置，请使用专门的PDF转换工具")
        else:
            raise Exception(f"不支持的文档格式: {target_format}")
            
        self.root.after(0, lambda: self.progress_var.set(75))

def main():
    root = tk.Tk()
    app = FileConverter(root)
    root.mainloop()

if __name__ == "__main__":
    main()