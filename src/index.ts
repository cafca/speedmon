#!/usr/bin/env node

import fetch from 'node-fetch';
import { performance, PerformanceObserver, PerformanceEntry } from 'perf_hooks';

// Conversion factor from bytes per millisecond to megabits per second
const CONVERSION_FACTOR = 0.008

// Resolution of measurements
let RESOLUTION = 1024 * 1024;

// Fixed buffer size of node-fetch https requests
const BUFFER_SIZE = 16 * 1024;


/**
 * Execute request and send transfer timings to observer
 */
const runMeasurement = async (url: string) => {
  const response = await fetch(url, { compress: false });

  if (!response || !response.ok || !response.body) {
    throw new Error('Invalid response body');
  }

  const contentLength = response.headers.get('Content-Length');
  if (!contentLength || parseInt(contentLength, 10) < 6 * RESOLUTION) {
    console.error('This payload is too small (min 6 megabytes)');
    process.exit(1);
  }

  let index = 0;
  const chunksPerMeasurement = RESOLUTION / BUFFER_SIZE;

  performance.mark('measurement-interval')
  for await (const chunk of response.body) {
    if (index % (chunksPerMeasurement) === 0) {
      performance.measure('received-data', {
        start: 'measurement-interval',
        detail: { index: Math.floor(index / chunksPerMeasurement) }
      });
      performance.mark('measurement-interval');
    }
    index += 1;
  }
}

/**
 * Request url parameter, observe transfer timings and calculate speed.
 */
const run = async (url: string): Promise<number> => {
  const measurements: number[] = [];

  if (!url.startsWith('http')) {
    url = `https://${url}`;
  }

  const obs = new PerformanceObserver((items) => {
    items.getEntriesByName('received-data').forEach((entry) => {
      measurements.push(CONVERSION_FACTOR * RESOLUTION / entry.duration)
    })
  })
  obs.observe({ type: 'measure' });
  await runMeasurement(url);
  obs.disconnect()

  // Sort all measurements and remove slowest 25% and two fastest results,
  // then return the average of the rest.
  const start = Math.round(measurements.length / 4);
  const end = measurements.length - 2;
  const filtered = measurements
    .sort((a, b) => a - b)
    .slice(start, end)

  if (filtered.length === 0) {
    throw new Error('Not enough speed measurements recorded');
  }
  const sum = filtered.reduce((prev, cur) => prev + cur, 0)
  const average = Math.floor(sum / filtered.length);
  return average;
}

const main = async () => {
  const url = process.argv[2];
  if (!url || url.length === 0) {
    console.error('Usage: speedmon <https://payload.url>')
    console.error('Payload should be larger than 6 megabytes')
    process.exit(1);
  }
  try {
    const currentSpeed = await run(url);
    console.log(`${currentSpeed} megabits per second`)
  } catch (err) {
    console.error('Measurement failed.', err)
    process.exit(1);
  }
}
main();
