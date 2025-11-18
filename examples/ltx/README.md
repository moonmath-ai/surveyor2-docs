# LTX Example

## Generate inputs YAML

```bash
surveyor2 inputs -r examples/ltx/baseline/ref1/ -r examples/ltx/baseline/ref2/ -g examples/ltx/gen_bad_1/ -p examples/ltx/prompts.jsonl -o inputs_bad.yaml
```

## Run evaluation

```bash
surveyor2 profile --inputs inputs_bad.yaml --report-json inputs_bad_report.json
```

