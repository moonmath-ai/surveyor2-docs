# Surveyor2 Python API

This document provides examples of using Surveyor2 programmatically in Python.

## Table of Contents

- [Basic Usage](#basic-usage)
- [Using Presets](#using-presets)
- [Custom Configuration](#custom-configuration)
- [Working with Reports](#working-with-reports)

---

## Basic Usage

The main entry point for programmatic usage is `run_profile()`, which evaluates videos and returns a `BatchReport`.

### Simple Example

```python
from surveyor2 import run_profile, BatchReport
from surveyor2.core.types import InputItem, ProfileConfig, MetricConfig, AggregateConfig

# Define input videos
inputs = [
    InputItem(
        video="path/to/generated_video.mp4",
        reference="path/to/reference_video.mp4",
        prompt="A cat playing with a ball",
        id="video_001"
    ),
    InputItem(
        video="path/to/generated_video2.mp4",
        reference="path/to/reference_video2.mp4",
        prompt="A dog running in a park",
        id="video_002"
    )
]

# Define metrics configuration
metrics_config = ProfileConfig(
    metrics=[
        MetricConfig(name="psnr", settings={}, params={}),
        MetricConfig(name="ssim", settings={}, params={}),
        MetricConfig(name="lpips", settings={"device": "cuda"}, params={}),
    ],
    aggregate=AggregateConfig(
        weights={"psnr": 1.0, "ssim": 1.0, "lpips": 1.0}
    )
)

# Run evaluation
batch_report, parse_errors = run_profile(
    inputs_list=inputs,
    profile_config=metrics_config,
    silent=False  # Set to True to disable progress bars
)

# Access results
print(f"Evaluated {len(batch_report.reports)} videos")
for i, report in enumerate(batch_report.reports):
    print(f"\nVideo {i+1} ({report.inputs.id}):")
    for metric in report.metrics:
        if metric.status == "ok":
            print(f"  {metric.name}: {metric.score:.4f}")
        else:
            print(f"  {metric.name}: ERROR - {metric.error}")

# Get composite score
if batch_report.composite_summary:
    print(f"\nComposite score: {batch_report.composite_summary['avg']:.4f}")
```

---

## Using Presets

Surveyor2 includes predefined metric configurations (presets) for common use cases.

### Available Presets

```python
from surveyor2.presets import list_presets, get_preset

# List available presets
presets = list_presets()
print(f"Available presets: {presets}")
# Example output: ['basic', 'fast', 'vbench', 'all']

# Load a preset
basic_config = get_preset("basic")
# Returns a ProfileConfig with PSNR and SSIM metrics

# Use with run_profile
from surveyor2 import run_profile
from surveyor2.core.parser import load_inputs_config

inputs_config = load_inputs_config("inputs.yaml")
batch_report, errors = run_profile(
    inputs_list=inputs_config.inputs,
    profile_config=basic_config
)
```

### Preset Examples

```python
from surveyor2.presets import get_preset
from surveyor2 import run_profile
from surveyor2.core.parser import load_inputs_config

inputs_config = load_inputs_config("inputs.yaml")

# Use 'fast' preset for quick evaluation
fast_config = get_preset("fast")
batch_report, _ = run_profile(inputs_config.inputs, fast_config)

# Use 'vbench' preset for comprehensive VBench evaluation
vbench_config = get_preset("vbench")
batch_report, _ = run_profile(inputs_config.inputs, vbench_config)

# Use 'all' preset for complete evaluation
all_config = get_preset("all")
batch_report, _ = run_profile(inputs_config.inputs, all_config)
```

---

## Custom Configuration

### Building Configuration Programmatically

```python
from surveyor2.core.types import ProfileConfig, MetricConfig, AggregateConfig

# Create custom metrics configuration
custom_config = ProfileConfig(
    metrics=[
        MetricConfig(
            name="lpips",
            settings={
                "device": "cuda",
                "backbone": "vgg",
                "batch_size": 8
            },
            params={}
        ),
        MetricConfig(
            name="clipscore",
            settings={
                "device": "cuda",
                "model": "ViT-B/32",
                "batch_size": 16
            },
            params={}
        ),
        MetricConfig(
            name="vbench_subject_consistency",
            settings={"device": "cuda"},
            params={}
        ),
    ],
    aggregate=AggregateConfig(
        weights={
            "lpips": 1.0,
            "clipscore": 2.0,
            "vbench_subject_consistency": 1.5
        }
    )
)
```

### Using Default Configuration

```python
from surveyor2.core.parser import build_default_metrics_config_from_registry

# Get default configuration (includes all metrics with enabled_by_default=True)
default_config = build_default_metrics_config_from_registry()

# Modify if needed
default_config.metrics.append(
    MetricConfig(name="vmaf", settings={}, params={})
)
```

---

## Working with Reports

### Accessing Individual Report Results

```python
from surveyor2 import run_profile, BatchReport, Report

batch_report, _ = run_profile(inputs_list, metrics_config)

# Iterate through individual reports
for i, report in enumerate(batch_report.reports):
    print(f"\nReport {i+1}:")
    print(f"  Video: {report.inputs.video}")
    print(f"  Reference: {report.inputs.reference}")
    print(f"  Prompt: {report.inputs.prompt}")
    
    # Access metrics
    for metric in report.metrics:
        print(f"  {metric.name}:")
        print(f"    Status: {metric.status}")
        if metric.status == "ok":
            print(f"    Score: {metric.score:.4f}")
            print(f"    Timing: {metric.timing_ms}ms")
            if metric.extras:
                print(f"    Extras: {metric.extras}")
        else:
            print(f"    Error: {metric.error}")
    
    # Access composite score
    if report.composite.get("enabled"):
        print(f"  Composite: {report.composite.get('score'):.4f}")
```

### Batch Summary Statistics

```python
batch_report, _ = run_profile(inputs_list, metrics_config)

# Compute summary statistics
batch_report.compute_summary()

# Access summary
if batch_report.summary:
    for metric_name, stats in batch_report.summary.items():
        print(f"{metric_name}:")
        print(f"  Min: {stats['min']:.4f}")
        print(f"  Max: {stats['max']:.4f}")
        print(f"  Avg: {stats['avg']:.4f}")

# Access composite summary
if batch_report.composite_summary:
    cs = batch_report.composite_summary
    print(f"Composite - Min: {cs['min']:.4f}, Max: {cs['max']:.4f}, Avg: {cs['avg']:.4f}")
```

### Exporting Reports

```python
# Export to JSON
json_str = batch_report.to_json(indent=2)
with open("report.json", "w") as f:
    f.write(json_str)

# Export to HTML
from surveyor2.core.html_report import render_batch_report_html

html = render_batch_report_html(batch_report, title="My Evaluation Report")
with open("report.html", "w") as f:
    f.write(html)

# Export markdown summary (use CLI command instead)
# The markdown generation is available via CLI:
# surveyor2 markdown --input report.json --output summary.md
```

---