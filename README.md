# Surveyor2

Video quality evaluation toolkit.

Surveyor2 is a comprehensive video quality assessment tool that evaluates your generated videos using metrics including LPIPS, CLIPScore, VBench, VisionReward and more. Simply point it at your videos and get detailed quality scores, baseline comparisons, and actionable insights. This tool can be used for benchmarking video generation models, tracking quality improvements, and integrating into your CI/CD pipeline with structured JSON reports.

## Demo

<video src="res/SurveyorDemo.mp4" controls width="100%">
  Your browser does not support the video tag.
</video>

---

## Install

Surveyor2 uses a **src layout** with `pyproject.toml`.

### Option A) One-command Conda env (recommended)
Creates Python 3.11, CUDA 12.4 PyTorch stack, ffmpeg+libvmaf, and extras.
```bash
conda env create -f environment.yml
conda activate surveyor2
pip install surveyor2

# Install vbench separately with --no-deps to avoid transformers version conflicts:
pip install vbench --no-deps

# VMAF requires a special version of ffmpeg. If you don't need VMAF you can skip this step
./scripts/install_vmaf.sh
# Don't forget to update your PATH variable
```

### Option B) Docker
Build and run Surveyor2 in a Docker container with all dependencies pre-installed.
```bash
# Build the Docker image
docker build -t surveyor2 .

# Run Surveyor2 (mount your data directories)
docker run --gpus all -v /path/to/your/videos:/workspace surveyor2 surveyor2 --help
```

---

## Usage

Surveyor2 uses a subcommand-based CLI. Run `surveyor2 --help` to see all available commands.

> **Python API**: For programmatic usage, see [API.md](API.md) for Python examples and API reference.

### Generate inputs YAML from video folders
Create an inputs YAML file by matching videos with prompts:
```bash
surveyor2 inputs \
  --reference-videos ./reference_videos \
  --generated-videos ./generated_videos \
  --prompts ./prompts.jsonl \
  --output inputs.yaml
```

The prompts file should be JSONL format with one JSON object per line:
```jsonl
{"id": "video_001", "prompt": "A cat playing with a ball"}
{"id": "video_002", "prompt": "A dog running in a park"}
```

### Run evaluation

**Using a default configuration:**
```bash
surveyor2 profile \
  --inputs examples/example_inputs_batch.yaml \
  --report-json out/report.json
```

**Using a preset:**
```bash
surveyor2 profile \
  --inputs examples/example_inputs_batch.yaml \
  --preset basic \
  --report-json out/report.json
```

Pass `--report-json` to write a JSON report (includes per-item reports and summary). Without it, results are printed to stdout only.

### Generate an HTML report
```bash
surveyor2 profile \
  --inputs examples/example_inputs_batch.yaml \
  --metrics metrics.yaml \
  --report-html out/report.html
```
This writes a single self‑contained HTML file with per-item tables and a batch summary.

### Generate markdown summary from JSON report
```bash
surveyor2 markdown \
  --input out/report.json \
  --output summary.md
```
This generates a markdown table with metric summaries, including baseline comparisons if available.

## Metrics

### List available metrics
See what's registered, their settings, and params:
```bash
surveyor2 profile --list
```
### Traditional (signal-based)
- **PSNR** (Peak Signal-to-Noise Ratio)
  - Measures pixel-level difference; high = better.
  - Weakness: weak correlation with perceived quality.
- **SSIM** (Structural Similarity)
  - Compares local patterns of pixel intensities; more perceptual than PSNR.

### Learned (perceptual/semantic)
- **LPIPS**
  - Pretrained CNN embeddings; correlates better with human perception.
- **CLIPScore / CLIP Similarity**
  - CLIP embeddings for text-video or video-video alignment; checks semantics.
- **VisionReward**
  - Fine-grained multi-dimensional reward model for human preference learning in videos.
  - Breaks down subjective judgments into interpretable dimensions with weighted scoring.
- **VMAF** (Netflix)
  - Learned fusion of PSNR, SSIM, perceptual features; requires ffmpeg with libvmaf.
- **VBench** (10 dimensions)
  - Comprehensive evaluation benchmark for text-to-video generation models.
  - Default-enabled dimensions: `subject_consistency`, `background_consistency`, `temporal_flickering`, `motion_smoothness`, `imaging_quality`, `overall_consistency`.
  - Optional dimensions: `dynamic_degree`, `aesthetic_quality`, `human_action`, `temporal_style`.

### Temporal consistency
- **t_lpips** (Temporal LPIPS)
  - LPIPS across consecutive frames; higher = more flicker.
- **tOF** (Temporal Optical Flow consistency)
  - Consistency of flow across time; lower = smoother motion.

### Additional Setup

All metric dependencies are included by default when installing via pip.

**VBench setup** (optional, install separately to avoid version conflicts):
```bash
pip install vbench --no-deps
```

**CLIPScore (OpenAI CLIP)** - included in conda environment, or install manually:
```bash
pip install git+https://github.com/openai/CLIP.git
```

**VMAF** requires system ffmpeg with libvmaf. If your ffmpeg lacks libvmaf:
```bash
bash install_vmaf.sh
# then add to ~/.bashrc:
# export PATH="/opt/ffmpeg/ffmpeg-static:$PATH"
source ~/.bashrc
ffmpeg -hide_banner -filters | grep -i vmaf  # should list libvmaf
```

### Metric presets
Surveyor2 includes predefined metric configurations for common use cases:

- **basic**: PSNR and SSIM (fast, reference-based metrics)
- **fast**: Temporal consistency and quality metrics (t_lpips, tOF, vbench_imaging_quality, vbench_temporal_flickering)
- **vbench**: Default VBench evaluation dimensions (6 enabled by default)
- **all**: Comprehensive evaluation with all available metrics (PSNR, SSIM, LPIPS, TLPIPS, CLIPScore, TOF, all 10 VBench dimensions, VisionReward, VMAF)

View predefined metric configurations:
```bash
surveyor2 presets
```

Use presets with the `--preset` flag:
```bash
surveyor2 profile --inputs inputs.yaml --preset basic --report-json report.json
```

### Using custom metrics configuration

Instead of using a preset, you can create a custom metrics configuration file to specify exactly which metrics to run and their settings. This gives you full control over the evaluation process.

**Generate a scaffold configuration file:**
```bash
surveyor2 scaffold --output metrics.yaml
```

This creates a template YAML file with all available metrics and their default settings. You can then edit this file to:
- Remove metrics you don't need
- Adjust metric settings (device, batch size, model variants, etc.)
- Configure aggregation weights for the composite score

**Use your custom configuration:**
```bash
surveyor2 profile \
  --inputs inputs.yaml \
  --metrics metrics.yaml \
  --report-json report.json
```

> **Note**  
> You don't need to keep every metric in the scaffold.  
> Feel free to remove or comment out metrics you don't want to run.

### Example metrics.yaml (annotated)
```yaml
metrics:
  - name: psnr
    settings: { max_pixel: 255.0 }
    params: {}
  - name: ssim
    settings: {}
    params: {}
  - name: lpips
    settings: { device: auto, backbone: vgg, batch_size: 8 }
    params: {}
  - name: clipscore
    settings: { device: auto, model: ViT-B/32, backend: auto, batch_size: 16 }
    params: {}
  - name: vbench_subject_consistency
    settings: { device: cuda }
    params: {}
  - name: visionreward
    settings: { device: auto }
    params: {}

aggregate:
  weights: { psnr: 1, ssim: 1, lpips: 2, clipscore: 2, vbench_subject_consistency: 1, visionreward: 1 }
```

---