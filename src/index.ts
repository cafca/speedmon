#!/usr/bin/env node
import { performance, PerformanceObserver, PerformanceEntry, createHistogram } from 'perf_hooks';
import fetch from 'node-fetch';

const ENDPOINT = 'https://001.land/50m.data'
const EXPECTED_SIZE = 50 * 1024 * 1024;

// Conversion factor from bytes per millisecond to megabits per second
const CONVERSION_FACTOR = 0.008

// Resolution of measurements
const RESOLUTION = 1024 * 1024;

// Fixed buffer size of node-fetch https requests
const BUFFER_SIZE = 16 * 1024;

const runMeasurement = async () => {
    const response = await fetch(ENDPOINT, { compress: false });

    if (!response || !response.ok || !response.body) {
        throw new Error('Invalid response body');
    }

    const contentLength = response.headers.get('Content-Length');
    if (!contentLength || parseInt(contentLength, 10) !== EXPECTED_SIZE) {
        throw new Error(
            `Did not receive a response with the expected length ${EXPECTED_SIZE}`
        );
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

const run = async (): Promise<number> => {
    const measurements: number[] = [];
    const obs = new PerformanceObserver((items) => {
        items.getEntriesByName('received-data').forEach((entry) => {
            measurements.push(getSpeed(entry))
        })

    })
    obs.observe({ type: 'measure' });
    try {
        await runMeasurement();
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

const main = () => {
    const runAndLog = async () => {
        const currentSpeed = await run();
        console.log(`${new Date().toLocaleTimeString()}: ${currentSpeed}mps`)
        setTimeout(runAndLog, 15 * 60 * 1000);
    }
    runAndLog()
}
main();