# Surveyor2 Dockerfile

# pytorch/pytorch:2.6.0-cuda12.4-cudnn9-runtime
FROM pytorch/pytorch@sha256:77f17f843507062875ce8be2a6f76aa6aa3df7f9ef1e31d9d7432f4b0f563dee

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    wget \
    xz-utils \
    git \
    libgl1 libglib2.0-0 libsm6 libxrender1 libxext6 \
    && rm -rf /var/lib/apt/lists/*

# Install FFmpeg (static build with libvmaf) from John Van Sickle
RUN wget -O /tmp/ffmpeg.tar.xz https://johnvansickle.com/ffmpeg/releases/ffmpeg-7.0.2-amd64-static.tar.xz \
    && tar -xf /tmp/ffmpeg.tar.xz -C /opt \
    && rm /tmp/ffmpeg.tar.xz \
    && mv /opt/ffmpeg-*-amd64-static /opt/ffmpeg-static \
    && ln -s /opt/ffmpeg-static/ffmpeg /usr/local/bin/ffmpeg \
    && ln -s /opt/ffmpeg-static/ffprobe /usr/local/bin/ffprobe

COPY . .

RUN pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
RUN pip install -e .[all]
RUN pip install vbench --no-deps

WORKDIR /workspace
