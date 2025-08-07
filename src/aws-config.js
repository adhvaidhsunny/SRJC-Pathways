import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const credentials = {
  accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY,
  sessionToken: process.env.REACT_APP_AWS_SESSION_TOKEN,
};

export const bedrockClient = new BedrockRuntimeClient({
  region: process.env.REACT_APP_AWS_REGION || "us-west-2",
  credentials,
});

const dynamoClient = new DynamoDBClient({
  region: process.env.REACT_APP_AWS_REGION || "us-west-2",
  credentials,
});

export const docClient = DynamoDBDocumentClient.from(dynamoClient);