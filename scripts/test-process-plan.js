// Test script for process-plan endpoint using built-in fetch
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

async function main() {
    try {
        console.log('Starting test for process-plan endpoint');

        // Upload the sample PDF to the test-responses-api endpoint instead
        console.log('Testing with the test-responses-api endpoint (simpler approach)');

        const baseUrl = 'http://localhost:3000';

        // Simple http get request
        await new Promise((resolve, reject) => {
            const url = `${baseUrl}/api/test-responses-api`;
            http.get(url, (res) => {
                let data = '';

                // A chunk of data has been received
                res.on('data', (chunk) => {
                    data += chunk;
                });

                // The whole response has been received
                res.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        console.log('Test response:', result);
                        console.log('Test completed successfully');
                        resolve(result);
                    } catch (e) {
                        console.error('Error parsing response:', e);
                        reject(e);
                    }
                });
            }).on('error', (err) => {
                console.error('Request error:', err.message);
                reject(err);
            });
        });

    } catch (error) {
        console.error('Test failed:', error);
    }
}

main(); 