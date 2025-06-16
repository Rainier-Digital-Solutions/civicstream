#!/usr/bin/env node

/**
 * Script to deploy the WebSocket API CloudFormation stack
 * 
 * Usage: node deploy-websocket-api.js
 * 
 * Environment variables:
 * - AWS_PROFILE: AWS profile to use (optional)
 * - AWS_REGION: AWS region to deploy to (default: us-west-2)
 * - STAGE: Deployment stage (default: dev)
 * - SUBMISSIONS_TABLE: Name of the existing DynamoDB submissions table (default: CivicStreamSubmissions)
 */

const { CloudFormationClient, CreateStackCommand, UpdateStackCommand, DescribeStacksCommand, DeleteStackCommand } = require('@aws-sdk/client-cloudformation');
const fs = require('fs');
const path = require('path');
const { exit } = require('process');

// Configuration
const region = process.env.AWS_REGION || 'us-west-2';
const stage = process.env.STAGE || 'dev';
const submissionsTable = process.env.SUBMISSIONS_TABLE || 'CivicStreamSubmissions';
const stackName = `CivicStreamWebSocketAPI-${stage}`;
const templatePath = path.join(__dirname, '..', 'aws', 'websocket-resources.yaml');

// Initialize CloudFormation client
const cfn = new CloudFormationClient({ region });

async function checkStackStatus() {
  try {
    const { Stacks } = await cfn.send(new DescribeStacksCommand({ StackName: stackName }));
    if (Stacks && Stacks.length > 0) {
      return {
        exists: true,
        status: Stacks[0].StackStatus
      };
    }
    return { exists: false };
  } catch (error) {
    // Stack does not exist
    return { exists: false };
  }
}

async function deleteStack() {
  console.log(`Deleting stack: ${stackName}`);
  try {
    await cfn.send(new DeleteStackCommand({ StackName: stackName }));
    console.log('Stack deletion initiated. Waiting for completion...');
    
    // Wait for stack to be deleted
    let stackStatus;
    do {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      try {
        const result = await checkStackStatus();
        stackStatus = result.exists ? result.status : null;
        if (stackStatus) {
          console.log(`Current stack status: ${stackStatus}`);
        }
      } catch (error) {
        // If we get an error checking status, the stack might be deleted
        stackStatus = null;
      }
    } while (stackStatus);
    
    console.log('Stack deleted successfully');
    return true;
  } catch (error) {
    console.error('Error deleting stack:', error);
    return false;
  }
}

async function deployStack() {
  console.log(`Deploying WebSocket API to ${region} in ${stage} stage...`);
  
  // Read CloudFormation template
  const templateBody = fs.readFileSync(templatePath, 'utf8');
  
  // Check if stack exists and get its status
  const stackInfo = await checkStackStatus();
  
  // Parameters for stack
  const parameters = [
    {
      ParameterKey: 'Stage',
      ParameterValue: stage
    },
    {
      ParameterKey: 'SubmissionsTableName',
      ParameterValue: submissionsTable
    }
  ];
  
  try {
    // If stack exists but is in ROLLBACK_COMPLETE state, we need to delete it first
    if (stackInfo.exists && stackInfo.status === 'ROLLBACK_COMPLETE') {
      console.log('Stack is in ROLLBACK_COMPLETE state. Deleting it before recreating...');
      const deleted = await deleteStack();
      if (!deleted) {
        console.error('Failed to delete stack in ROLLBACK_COMPLETE state');
        exit(1);
      }
      stackInfo.exists = false; // Stack no longer exists after deletion
    }
    
    if (stackInfo.exists) {
      // Update existing stack
      console.log(`Updating existing stack: ${stackName}`);
      const updateCommand = new UpdateStackCommand({
        StackName: stackName,
        TemplateBody: templateBody,
        Parameters: parameters,
        Capabilities: ['CAPABILITY_IAM']
      });
      
      await cfn.send(updateCommand);
    } else {
      // Create new stack
      console.log(`Creating new stack: ${stackName}`);
      const createCommand = new CreateStackCommand({
        StackName: stackName,
        TemplateBody: templateBody,
        Parameters: parameters,
        Capabilities: ['CAPABILITY_IAM']
      });
      
      await cfn.send(createCommand);
    }
    
    console.log(`Stack ${stackInfo.exists ? 'update' : 'creation'} initiated successfully.`);
    console.log(`Check the AWS CloudFormation console for stack status.`);
    console.log(`Once deployed, update the NEXT_PUBLIC_WEBSOCKET_API_URL environment variable in .env.local with the WebSocket API endpoint.`);
    
  } catch (error) {
    console.error('Error deploying stack:', error);
    exit(1);
  }
}

// Run the deployment
deployStack();
