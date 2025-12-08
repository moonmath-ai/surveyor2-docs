# Surveyor2 Python API

This document provides examples of using Surveyor2 programmatically in Python.

## Table of Contents

- [Basic Usage](#basic-usage)
- [Multiple Reference Videos](#multiple-reference-videos)
- [Using Presets](#using-presets)
- [Custom Configuration](#custom-configuration)
- [Working with Reports](#working-with-reports)
- [Baseline Comparisons](#baseline-comparisons)

---

## Basic Usage

The main entry point for programmatic usage is `run_profile()`, which evaluates videos and returns a `BatchReport`.

### Simple Example

```python
from surveyor2 import run_profile
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
    for result in report.results:
        metric = result.generated
        if metric.status == "ok":
            print(f"  {metric.name}: {metric.score:.4f}")
        else:
            print(f"  {metric.name}: ERROR - {metric.error}")

# Get batch summary statistics
summary = batch_report.get_summary()
for metric_name, stats in summary.items():
    print(f"{metric_name}: min={stats['min']:.4f}, max={stats['max']:.4f}, avg={stats['avg']:.4f}")

# Get composite score summary
weights = metrics_config.aggregate.weights
composite_summary = batch_report.get_composite_summary(weights)
if composite_summary:
    print(f"\nComposite: min={composite_summary['min']:.4f}, max={composite_summary['max']:.4f}, avg={composite_summary['avg']:.4f}")
```

---

## Multiple Reference Videos

Surveyor2 supports comparing a generated video against multiple reference videos for baseline statistics.

```python
from surveyor2 import run_profile
from surveyor2.core.types import InputItem, ProfileConfig, MetricConfig, AggregateConfig

# Define input with multiple reference videos
inputs = [
    InputItem(
        video="generated.mp4",
        reference=["ref1.mp4", "ref2.mp4", "ref3.mp4"],  # Multiple references
        prompt="A cat playing with a ball",
        id="multi_ref_example"
    )
]

# Configure metrics
metrics_config = ProfileConfig(
    metrics=[
        MetricConfig(name="psnr", settings={}, params={}),
        MetricConfig(name="ssim", settings={}, params={}),
    ],
    aggregate=AggregateConfig(weights={"psnr": 1.0, "ssim": 1.0})
)

# Run evaluation
batch_report, _ = run_profile(inputs, metrics_config)

# Access baseline comparisons
for report in batch_report.reports:
    for result in report.results:
        print(f"\n{result.generated.name}:")
        print(f"  Generated score: {result.generated.score:.4f}")
        print(f"  Baseline average: {result.get_baseline_average():.4f}")
        print(f"  Percentage diff: {result.get_pct_diff():.2f}%")
```

---

## Using Presets

Surveyor2 includes predefined metric configurations (presets) for common use cases:
- **basic**: PSNR and SSIM (fast, reference-based metrics)
- **fast**: Temporal consistency and quality metrics
- **vbench**: Default VBench evaluation dimensions
- **all**: Comprehensive evaluation with all available metrics

```python
from surveyor2 import list_presets, get_preset, run_profile, load_inputs_config

# List all available presets
presets = list_presets()
print(f"Available presets: {presets}")

# Load inputs from file
inputs_config = load_inputs_config("inputs.yaml")

# Use basic preset (PSNR and SSIM)
basic_config = get_preset("basic")
batch_report, errors = run_profile(
    inputs_list=inputs_config.inputs,
    profile_config=basic_config
)

# Use fast preset (temporal consistency metrics)
fast_config = get_preset("fast")
batch_report, _ = run_profile(inputs_config.inputs, fast_config)

# Use all preset (comprehensive evaluation)
all_config = get_preset("all")
batch_report, _ = run_profile(inputs_config.inputs, all_config)
```

---

## Custom Configuration

### Building Configuration Programmatically

```python
from surveyor2 import ProfileConfig, MetricConfig, AggregateConfig

# Create custom metrics configuration
custom_config = ProfileConfig(
    metrics=[
        # Configure LPIPS metric
        MetricConfig(
            name="lpips",
            settings={
                "device": "cuda",
                "backbone": "vgg",
                "batch_size": 8
            },
            params={}
        ),
        # Configure CLIPScore metric
        MetricConfig(
            name="clipscore",
            settings={
                "device": "cuda",
                "model": "ViT-B/32",
                "batch_size": 16
            },
            params={}
        ),
        # Configure VBench subject consistency
        MetricConfig(
            name="vbench_subject_consistency",
            settings={"device": "cuda"},
            params={}
        ),
    ],
    # Define aggregation weights for composite score
    aggregate=AggregateConfig(
        weights={
            "lpips": 1.0,
            "clipscore": 2.0,
            "vbench_subject_consistency": 1.5
        }
    )
)
```

### Loading Configuration from File

```python
from surveyor2 import load_metrics_config, run_profile, load_inputs_config

# Load metrics configuration from YAML file
metrics_config = load_metrics_config("metrics.yaml")

# Load inputs configuration from YAML file
inputs_config = load_inputs_config("inputs.yaml")

# Run evaluation with loaded configurations
batch_report, errors = run_profile(
    inputs_list=inputs_config.inputs,
    profile_config=metrics_config
)
```

---

## Working with Reports

### Accessing Individual Report Results

```python
from surveyor2 import run_profile

# Run evaluation
batch_report, _ = run_profile(inputs_list, metrics_config)

# Iterate through individual video reports
for report in batch_report.reports:
    print(f"\nVideo: {report.inputs.video}")
    print(f"  ID: {report.inputs.id}")
    print(f"  Reference: {report.inputs.reference}")
    print(f"  Prompt: {report.inputs.prompt}")
    
    # Access metric results for this video
    for result in report.results:
        metric = result.generated  # Generated video metric
        print(f"\n  {metric.name}:")
        print(f"    Status: {metric.status}")
        
        if metric.status == "ok":
            print(f"    Score: {metric.score:.4f}")
            print(f"    Timing: {metric.timing_ms}ms")
            
            # Get baseline average (if reference videos provided)
            baseline_avg = result.get_baseline_average()
            if baseline_avg is not None:
                print(f"    Baseline avg: {baseline_avg:.4f}")
                pct_diff = result.get_pct_diff()
                if pct_diff:
                    print(f"    Diff: {pct_diff:+.2f}%")
            
            # Get quality label (for single reference metrics)
            quality_label = result.get_quality_label()
            if quality_label:
                print(f"    Quality: {quality_label}")
            
            # Additional metric-specific data
            if metric.extras:
                print(f"    Extras: {metric.extras}")
        else:
            print(f"    Error: {metric.error}")
    
    # Get composite score for this video
    composite = report.get_composite(metrics_config.aggregate.weights)
    if composite.get("enabled") and composite.get("score"):
        print(f"\n  Composite: {composite['score']:.4f}")
```

### Batch Summary Statistics

```python
batch_report, _ = run_profile(inputs_list, metrics_config)

# Get summary statistics for each metric (min/max/avg across all videos)
summary = batch_report.get_summary()
for metric_name, stats in summary.items():
    print(f"{metric_name}:")
    print(f"  Min: {stats['min']:.4f}")
    print(f"  Max: {stats['max']:.4f}")
    print(f"  Avg: {stats['avg']:.4f}")

# Get composite score summary
weights = metrics_config.aggregate.weights
composite_summary = batch_report.get_composite_summary(weights)
if composite_summary:
    print(f"\nComposite:")
    print(f"  Min: {composite_summary['min']:.4f}")
    print(f"  Max: {composite_summary['max']:.4f}")
    print(f"  Avg: {composite_summary['avg']:.4f}")
```

### Saving and Loading Reports

```python
import pathlib
from surveyor2 import run_profile
from surveyor2.core.report import BatchReport

# Run evaluation
batch_report, _ = run_profile(inputs_list, metrics_config)

# Save report to JSON file
weights = metrics_config.aggregate.weights
json_str = batch_report.to_json(weights=weights)
pathlib.Path("report.json").write_text(json_str)

# Load report from JSON file
loaded_batch = BatchReport.from_json(pathlib.Path("report.json").read_text())
print(f"Loaded {len(loaded_batch.reports)} reports")
```

---

## Baseline Comparisons

When reference videos are provided, Surveyor2 automatically computes baseline statistics and percentage differences.

### Single Reference Video

```python
from surveyor2 import run_profile, InputItem, ProfileConfig, MetricConfig, AggregateConfig

# Define input with single reference
inputs = [
    InputItem(
        video="generated.mp4",
        reference="reference.mp4",  # Single reference video
        id="comparison_test"
    )
]

# Configure metrics
config = ProfileConfig(
    metrics=[MetricConfig(name="psnr", settings={}, params={})],
    aggregate=AggregateConfig(weights={"psnr": 1.0})
)

# Run evaluation
batch_report, _ = run_profile(inputs, config)

# Access baseline comparisons with quality labels
for report in batch_report.reports:
    for result in report.results:
        print(f"{result.generated.name}:")
        print(f"  Generated: {result.generated.score:.4f}")
        print(f"  Baseline: {result.get_baseline_average():.4f}")
        print(f"  Quality: {result.get_quality_label()}")  # e.g., "excellent", "good", "fair", "poor"
```

### Multiple Reference Videos

```python
# Define input with multiple references
inputs = [
    InputItem(
        video="generated.mp4",
        reference=["ref1.mp4", "ref2.mp4", "ref3.mp4"],  # Multiple reference videos
        id="multi_baseline"
    )
]

# Run evaluation
batch_report, _ = run_profile(inputs, config)

# Access detailed baseline comparisons
for report in batch_report.reports:
    for result in report.results:
        print(f"\n{result.generated.name}:")
        print(f"  Generated score: {result.generated.score:.4f}")
        print(f"  Baseline scores: {[b.score for b in result.baseline]}")  # All baseline scores
        print(f"  Baseline average: {result.get_baseline_average():.4f}")  # Average of baselines
        print(f"  Percentage diff: {result.get_pct_diff():.2f}%")  # % difference from baseline avg
```