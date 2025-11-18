# Surveyor2 Examples

This folder contains a minimal, copy-pasteable flow to get a report out of Surveyor2.

## Quickstart

```bash
# from repository root
bash examples/run_example.sh
```

The script will:
1. **List** registered metrics (`surveyor2 --list`).
2. **Generate** a dynamic **config scaffold** (`example_config_1.yaml`) based on the registry.
3. Ask you to **edit** the config (set `inputs.video`, and `inputs.reference` for full-reference metrics).
4. **Run** the evaluation and write `out/report.json`.

> **Note**  
> You don’t need to keep every metric in the scaffold. Feel free to remove or comment out metrics you don’t want to run.

## Installs

- Everything (LPIPS + CLIPScore + imageio[ffmpeg]):
  ```bash
  pip install -e .[all]
  ```

<!-- ## Adding CI thresholds (optional)

You can gate the run in CI by adding a `ci:` block to your config:

```yaml
ci:
  required_metrics: [psnr, ssim]
  thresholds:
    psnr_min: 25.0
    ssim_min: 0.70
    lpips_max: 0.30
    clipscore_min: 0.40
  composite:
    min: 0.75
``` -->

If thresholds are violated, the driver prints reasons and exits **non-zero**, suitable for GitHub Actions/Jenkins.

## Interpreting results (cheat sheet)

- **PSNR (dB, higher=better):** <20 poor, 20–30 moderate, 30–40 good, >40 excellent  
- **SSIM (0–1, higher=better):** <0.5 poor, 0.5–0.8 moderate, >0.8 high  
- **LPIPS (0–1, lower=better):** 0–0.2 excellent, 0.2–0.4 good, 0.4–0.7 noticeable, >0.7 poor  
- **CLIPScore (0–1, higher=better):** <0.2 weak, 0.2–0.4 partial, >0.4 good

## Tips

- Use `jq` to pretty-print the report:
  ```bash
  jq . out/report.json
  ```
- For tiny sanity checks without internet, generate a video with ffmpeg:
  ```bash
  ffmpeg -f lavfi -i color=c=blue:s=320x240:d=2 -pix_fmt yuv420p sample.mp4
  ```
