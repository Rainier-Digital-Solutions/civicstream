/**
 * Utility function to update a submission status via the API
 * This can be imported and used by Lambda functions or other backend processes
 */

const https = require('https');
const http = require('http');

/**
 * Updates the status of a submission via the API
 * 
 * @param {string} apiUrl - The base URL of the API (e.g., 'https://civicstream.com')
 * @param {string} submissionId - The ID of the submission to update
 * @param {string} status - The new status ('Processing', 'Analysis Complete', 'Findings Report Emailed')
 * @returns {Promise<Object>} - The updated submission object
 */
async function updateSubmissionStatus(apiUrl, submissionId, status) {
  if (!submissionId || !status) {
    throw new Error('Both submissionId and status are required');
  }

  const validStatuses = ['Processing', 'Analysis Complete', 'Findings Report Emailed'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Status must be one of: ${validStatuses.join(', ')}`);
  }

  // Remove trailing slash from API URL if present
  const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
  const url = `${baseUrl}/api/submissions`;

  const requestOptions = {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const requestBody = JSON.stringify({
    submissionId,
    status,
  });

  return new Promise((resolve, reject) => {
    // Choose http or https module based on URL
    const httpModule = url.startsWith('https') ? https : http;
    
    const req = httpModule.request(url, requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsedData = JSON.parse(data);
            resolve(parsedData);
          } catch (error) {
            reject(new Error(`Error parsing response: ${error.message}`));
          }
        } else {
          reject(new Error(`Request failed with status code ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.write(requestBody);
    req.end();
  });
}

module.exports = {
  updateSubmissionStatus,
};
