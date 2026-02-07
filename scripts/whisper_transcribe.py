"""
Whisper Local Transcription Service
Usa openai-whisper (oficial) para transcrição offline de alta qualidade
"""

import sys
import json
import os
from datetime import timedelta
import warnings

# Configurar FFmpeg path (usa o FFmpeg do projeto Node.js)
# Whisper precisa do FFmpeg para extrair áudio do vídeo
if os.name == 'nt':  # Windows
    # Caminho do FFmpeg instalado pelo npm
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)  # Subir um nível (de scripts/ para hub/)
    
    ffmpeg_path = os.path.join(project_root, 'node_modules', '@ffmpeg-installer', 'win32-x64', 'ffmpeg.exe')
    
    if os.path.exists(ffmpeg_path):
        os.environ['PATH'] = os.path.dirname(ffmpeg_path) + os.pathsep + os.environ.get('PATH', '')
        print(f"[Whisper] FFmpeg encontrado: {ffmpeg_path}", file=sys.stderr)
    else:
        print(f"[Whisper] AVISO: FFmpeg não encontrado em {ffmpeg_path}", file=sys.stderr)

import whisper

# Suprimir warnings do PyTorch
warnings.filterwarnings("ignore")

def format_timestamp(seconds: float) -> str:
    """Converte segundos para formato SRT (HH:MM:SS,mmm)"""
    td = timedelta(seconds=seconds)
    hours = td.seconds // 3600
    minutes = (td.seconds % 3600) // 60
    secs = td.seconds % 60
    millis = td.microseconds // 1000
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

def transcribe_to_srt(video_path: str, model_size: str = "medium", language: str = "pt") -> str:
    """
    Transcreve vídeo e retorna conteúdo SRT
    
    Args:
        video_path: Caminho do arquivo de vídeo
        model_size: Tamanho do modelo (tiny, base, small, medium, large)
        language: Código do idioma (pt, en, es, etc)
    
    Returns:
        Conteúdo do arquivo SRT
    """
    print(f"[Whisper] Carregando modelo '{model_size}'...", file=sys.stderr)
    
    # Carregar modelo
    # device="cuda" para GPU, "cpu" para CPU
    try:
        model = whisper.load_model(model_size, device="cuda")
        print(f"[Whisper] Usando GPU (CUDA)", file=sys.stderr)
    except:
        model = whisper.load_model(model_size, device="cpu")
        print(f"[Whisper] Usando CPU (mais lento)", file=sys.stderr)
    
    print(f"[Whisper] Transcrevendo '{video_path}'...", file=sys.stderr)
    
    # Transcrever
    result = whisper.transcribe(
        model,
        video_path,
        language=language,
        verbose=False,
        word_timestamps=True  # Timestamps palavra por palavra
    )
    
    print(f"[Whisper] Idioma detectado: {result['language']}", file=sys.stderr)
    print(f"[Whisper] Texto: {result['text'][:100]}...", file=sys.stderr)
    
    # Gerar SRT a partir dos segmentos
    srt_lines = []
    for i, segment in enumerate(result['segments'], 1):
        start = format_timestamp(segment['start'])
        end = format_timestamp(segment['end'])
        text = segment['text'].strip()
        
        srt_lines.append(f"{i}")
        srt_lines.append(f"{start} --> {end}")
        srt_lines.append(text)
        srt_lines.append("")  # Linha em branco entre segmentos
    
    print(f"[Whisper] Transcrição concluída! {i} segmentos gerados", file=sys.stderr)
    
    return "\n".join(srt_lines)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "Uso: python whisper_transcribe.py <video_path> [model_size] [language]"
        }))
        sys.exit(1)
    
    video_path = sys.argv[1]
    model_size = sys.argv[2] if len(sys.argv) > 2 else "medium"
    language = sys.argv[3] if len(sys.argv) > 3 else "pt"
    
    try:
        srt_content = transcribe_to_srt(video_path, model_size, language)
        
        # Retornar SRT como JSON para facilitar parsing no Node.js
        print(json.dumps({
            "success": True,
            "srt": srt_content
        }))
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }), file=sys.stderr)
        sys.exit(1)
