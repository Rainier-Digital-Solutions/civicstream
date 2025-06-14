#!/usr/bin/env node

/**
 * Script to check the status of the WebSocket API CloudFormation stack
 * and retrieve the WebSocket API endpoint when ready.
 */

const { CloudFormationClient, DescribeStacksCommand } = require('@aws-sdk/client-cloudformation');
const fs = require('fs');
const path = require('path');

// Configuration
const region = process.env.AWS_REGION || 'us-west-2';
const stage = process.env.STAGE || 'dev';
const stackName = `CivicStreamWebSocketAPI-${stage}`;

// Initialize CloudFormation client
const cfn = new CloudFormationClient({ region });

async function checkStackStatus() {
  try {
    console.log(`Checking status of stack: ${stackName}...`);
    
    const { Stacks } = await cfn.send(new DescribeStacksCommand({ StackName: stackName }));
    
    if (Stacks && Stacks.length > 0) {
      const stack = Stacks[0];
      console.log(`Stack status: ${stack.StackStatus}`);
      
      if (stack.StackStatus === 'CREATE_COMPLETE' || stack.StackStatus === 'UPDATE_COMPLETE') {
        // Stack is ready, get the WebSocket API endpoint
        const outputs = stack.Outputs || [];
        const endpointOutput = outputs.find(output => output.OutputKey === 'WebSocketAPIEndpoint');
        
        if (endpointOutput && endpointOutput.OutputValue) {
          const endpoint = endpointOutput.OutputValue;
          console.log(`\nWebSocket API endpoint: ${endpoint}`);
          console.log('\nAdd this to your .env.local file as:');
          console.log(`NEXT_PUBLIC_WEBSOCKET_API_URL=${endpoint}\n`);
          
          // Update .env.local file if it exists
          const envFilePath = path.join(process.cwd(), '.env.local');
          if (fs.existsSync(envFilePath)) {
            try {
              let envContent = fs.readFileSync(envFilePath, 'utf8');
              
              // Check if NEXT_PUBLIC_WEBSOCKET_API_URL already exists
              if (envContent.includes('NEXT_PUBLIC_WEBSOCKET_API_URL=')) {
                // Replace existing value
                envContent = envContent.replace(
                  /NEXT_PUBLIC_WEBSOCKET_API_URL=.*/,
                  `NEXT_PUBLIC_WEBSOCKET_API_URL=${endpoint}`
                );
              } else {
                // Add new value
                envContent += `\nNEXT_PUBLIC_WEBSOCKET_API_URL=${endpoint}\n`;
              }
              
              fs.writeFileSync(envFilePath, envContent);
              console.log('Updated .env.local file with WebSocket API endpoint.');
            } catch (error) {
              console.error('Error updating .env.local file:', error);
              console.log('Please manually add the WebSocket API endpoint to your .env.local file.');
            }
          } else {
            console.log('No .env.local file found. Please create one and add the WebSocket API endpoint.');
          }
        } else {
          console.error('WebSocket API endpoint not found in stack outputs.');
        }
      } else if (stack.StackStatus.includes('FAILED') || stack.StackStatus.includes('ROLLBACK')) {
        console.error('Stack deployment failed or rolled back.');
      } else {
        console.log('Stack is still being deployed. Check again in a few minutes.');
      }
    } else {
      console.error('Stack not found.');
    }
  } catch (error) {
    console.error('Error checking stack status:', error);
  }
}

checkStackStatus();
