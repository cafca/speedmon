# speedmon

Measure an internet connection's bandwidth.

- Takes continuous performance measurements while downloading a supplied URL endpoint.
- Calculates connection speed from measurements by discarding slowest 25% of measurements as well as fastest 2 measurements and averaging the rest.

## Usage

```
$ npx speedmon <your payload address>
```

Payload should be at least six megabytes.
