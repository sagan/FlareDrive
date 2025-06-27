import { createGraphQLClient } from "@shopify/graphql-client";
import { checkAuthFailure, FdCfFunc, jsonResponse, responseInternalServerError } from "../commons";

// Use Cloudflare GraphQL Analytics API
// https://developers.cloudflare.com/analytics/graphql-api/
const CF_GRAPHQL_API = "https://api.cloudflare.com/client/v4/graphql";

const document = `
  query GetR2BucketStatistics($accountTag: string, $bucketName: string, $startDate: Time, $endDate: Time) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        r2StorageAdaptiveGroups(
          filter: { bucketName: $bucketName, datetime_geq: $startDate, datetime_leq: $endDate }
          limit: 1 
          orderBy: [datetime_DESC]
        ) {
          max {
            objectCount
            uploadCount
            payloadSize
            metadataSize
          }
          dimensions {
            datetime
          }
        }
        classA: r2OperationsAdaptiveGroups(
          filter: {
            datetime_geq: $startDate,
            datetime_leq: $endDate,
            bucketName: $bucketName,
            actionType_in: [
              "ListBuckets",
              "PutBucket",
              "ListObjects",
              "PutObject",
              "CopyObject",
              "CompleteMultipartUpload",
              "CreateMultipartUpload",
              "ListMultipartUploads",
              "UploadPart",
              "UploadPartCopy",
              "ListParts",
              "PutBucketEncryption",
              "PutBucketCors",
              "PutBucketLifecycleConfiguration"
            ]
          },
          limit: 1
        ) {
          sum {
            requests
          }
        }
        classB: r2OperationsAdaptiveGroups(
          filter: {
            datetime_geq: $startDate,
            datetime_leq: $endDate,
            bucketName: $bucketName,
            actionType_in: [
              "HeadBucket",
              "HeadObject",
              "GetObject",
              "GetBucketEncryption",
              "GetBucketLocation",
              "GetBucketCors",
              "GetBucketLifecycleConfiguration"
            ]
          },
          limit: 1
        ) {
          sum {
            requests
          }
        }
      }
    }
  }
`;

export const onRequestGet: FdCfFunc = async function (context) {
  const { request, env } = context;
  const [failResponse] = await checkAuthFailure(request, env.WEBDAV_USERNAME, env.WEBDAV_PASSWORD);
  if (failResponse) {
    return failResponse;
  }
  if (!env.CF_ACCOUNT_ID || !env.CF_ANALYTICS_TOKEN || !env.CF_BUCKET_NAME) {
    return responseInternalServerError("CF_ACCOUNT_ID, CF_ANALYTICS_TOKEN, CF_BUCKET_NAME env must be set");
  }
  const client = createGraphQLClient({
    url: CF_GRAPHQL_API,
    headers: {
      Authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}`,
    },
  });

  const today = new Date();
  const firstDayOfMonth = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1);
  const lastDayOfMonth = Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0);

  const { data, errors, extensions } = await client.request(document, {
    variables: {
      accountTag: env.CF_ACCOUNT_ID,
      bucketName: env.CF_BUCKET_NAME,
      startDate: new Date(firstDayOfMonth).toISOString().slice(0, 19) + "Z",
      endDate: new Date(lastDayOfMonth).toISOString().slice(0, 19) + "Z",
    },
  });
  return jsonResponse(data);
};
