#!/usr/bin/env node

import fetch from 'node-fetch';
import { performance, PerformanceObserver, PerformanceEntry } from 'perf_hooks';

// Conversion factor from bytes per millisecond to megabits per second
const CONVERSION_FACTOR = 0.008

// Resolution of measurements
let RESOLUTION = 1024 * 1024;

// Fixed buffer size of node-fetch https requests
const BUFFER_SIZE = 16 * 1024;

const runMeasurement = async (url: string) => {
    const response = await fetch(url, { compress: false });

    if (!response || !response.ok || !response.body) {
        throw new Error('Invalid response body');
    }

    const contentLength = response.headers.get('Content-Length');
    if(!contentLength || parseInt(contentLength, 10) < 6 * RESOLUTION) {
        console.error('This payload is too small (min 6 megabyte)');
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

const getSpeed = (result: PerformanceEntry): number => {
    return CONVERSION_FACTOR * RESOLUTION / result.duration;
}

const run = async (url: string): Promise<number> => {
    const measurements: number[] = [];

    if (!url.startsWith('http')) {
        url = `https://${url}`;
    }

    const obs = new PerformanceObserver((items) => {
        items.getEntriesByName('received-data').forEach((entry) => {
            measurements.push(getSpeed(entry))
        })

    })
    obs.observe({ type: 'measure' });
    try {
        await runMeasurement(url);
    } catch (err) {
        console.error('Measurement failed');
        console.error(err);
    }
    obs.disconnect()

    const start = Math.round(measurements.length / 4);
    const end = measurements.length - 2;
    const filtered = measurements
        .sort((a,b) => a - b)
        .slice(start, end)
    const average = Math.floor(filtered.reduce((prev, cur) => prev + cur, 0) / filtered.length);
    return average;
}

const main = async () => {
    const url = process.argv[2];
    if (!url || url.length === 0) {
        console.error('Usage: speedmon <https://payload.url>')
        console.error('Payload should be larger than 6 megabytes')
        process.exit(1);
    }
    const currentSpeed = await run(url);
    console.log(`${currentSpeed}mps`)
}
main();