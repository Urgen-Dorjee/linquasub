# -*- mode: python ; coding: utf-8 -*-
import os
import sys
import site

# Find the venv site-packages
venv_base = os.path.join(SPECPATH, 'venv')
site_packages = os.path.join(venv_base, 'Lib', 'site-packages')

# ctranslate2 DLLs
ct2_dir = os.path.join(site_packages, 'ctranslate2')
ct2_binaries = []
for f in os.listdir(ct2_dir):
    full = os.path.join(ct2_dir, f)
    if f.endswith('.dll') and os.path.isfile(full):
        ct2_binaries.append((full, 'ctranslate2'))

# faster_whisper assets (VAD model)
fw_assets_dir = os.path.join(site_packages, 'faster_whisper', 'assets')
fw_datas = []
if os.path.exists(fw_assets_dir):
    for f in os.listdir(fw_assets_dir):
        full = os.path.join(fw_assets_dir, f)
        if os.path.isfile(full) and not f.startswith('__'):
            fw_datas.append((full, os.path.join('faster_whisper', 'assets')))

# onnxruntime DLLs
ort_dir = os.path.join(site_packages, 'onnxruntime', 'capi')
ort_binaries = []
if os.path.exists(ort_dir):
    for f in os.listdir(ort_dir):
        full = os.path.join(ort_dir, f)
        if f.endswith('.dll') and os.path.isfile(full):
            ort_binaries.append((full, 'onnxruntime/capi'))

a = Analysis(
    ['main.py'],
    pathex=[SPECPATH],
    binaries=ct2_binaries + ort_binaries,
    datas=fw_datas,
    hiddenimports=[
        'uvicorn',
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'websockets',
        'websockets.legacy',
        'websockets.legacy.server',
        'fastapi',
        'starlette',
        'starlette.routing',
        'starlette.middleware',
        'starlette.middleware.cors',
        'pydantic',
        'pydantic_settings',
        'pydantic_core',
        'ctranslate2',
        'faster_whisper',
        'onnxruntime',
        'deepl',
        'yt_dlp',
        'aiofiles',
        'python_multipart',
        'httptools',
        'watchfiles',
        'h11',
        'httpcore',
        'httpx',
        'huggingface_hub',
        'tokenizers',
        'numpy',
        'certifi',
        'routers',
        'routers.system',
        'routers.video',
        'routers.transcription',
        'routers.translation',
        'routers.export',
        'services',
        'services.whisper_service',
        'services.translation_service',
        'services.subtitle_service',
        'services.karaoke_service',
        'services.ffmpeg_service',
        'services.youtube_service',
        'core',
        'core.websocket_manager',
        'core.task_manager',
        'core.gpu_utils',
        'core.ffmpeg_utils',
        'models',
        'models.schemas',
        'config',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter',
        'matplotlib',
        'scipy',
        'pandas',
        'PIL',
        'cv2',
        'torch',
        'tensorflow',
        'pytest',
        'sphinx',
    ],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='backend',
)
