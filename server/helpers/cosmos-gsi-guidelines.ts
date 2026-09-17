/**
 * Azure Cosmos DB Indexing & GSI Guidelines
 * 
 * Comprehensive reference guide for Azure Cosmos DB partition key modeling,
 * Indexing Policies, and avoiding high-RU cross-partition fan-out queries.
 */

export interface CosmosIndexingGuideline {
  title: string;
  concept: string;
  recommendation: string;
  exampleJson?: object;
  sqlPattern?: string;
  ruImpact: string;
}

export const COSMOS_GSI_GUIDELINES: {
  overview: string;
  partitionStrategy: string;
  indexingPolicy: object;
  guidelines: CosmosIndexingGuideline[];
} = {
  overview: 
    "In Azure Cosmos DB (NoSQL API), there is no literal 'Global Secondary Index (GSI)' keyword like AWS DynamoDB. " +
    "Instead, Cosmos DB automatically builds an inverted index on all paths (/*). However, the critical performance " +
    "differentiator is avoiding CROSS-PARTITION QUERIES (queries without the Partition Key in the WHERE clause), which " +
    "force Cosmos DB to fan out across all physical partitions, consuming high Request Units (RUs) and adding latency.",

  partitionStrategy:
    "For the 'emails' container in the 'emails' database, the Partition Key is defined as '/pk'.\n" +
    "- Shared/Departmental inboxes: pk = 'help', 'payments', 'ceo', 'admin', 'support'\n" +
    "- Personal employee/manager/agent inboxes: pk = 'collinsjuma@housika.co.ke'\n" +
    "This ensures that 99% of read operations (listing inbox, fetching email by ID, checking unread) are strictly SINGLE-PARTITION queries.",

  indexingPolicy: {
    indexingMode: "consistent",
    automatic: true,
    includedPaths: [
      { path: "/*" }
    ],
    excludedPaths: [
      { path: "/\"_etag\"/?" },
      // Exclude large text fields from indexing to save storage & write RUs (files are in R2)
      { path: "/htmlContent/?" },
      { path: "/rawMime/?" }
    ],
    compositeIndexes: [
      // Fast inbox pagination: pk + createdAt DESC
      [
        { path: "/pk", order: "ascending" },
        { path: "/createdAt", order: "descending" }
      ],
      // Filtered status listing: pk + status + createdAt DESC
      [
        { path: "/pk", order: "ascending" },
        { path: "/status", order: "ascending" },
        { path: "/createdAt", order: "descending" }
      ],
      // Thread tracking within mailbox: pk + threadId + createdAt ASC
      [
        { path: "/pk", order: "ascending" },
        { path: "/threadId", order: "ascending" },
        { path: "/createdAt", order: "ascending" }
      ]
    ]
  },

  guidelines: [
    {
      title: "1. Always Supply the Partition Key in Queries",
      concept: "Single-Partition vs Cross-Partition Queries",
      recommendation: "Always include 'WHERE c.pk = @pk' in your queries or use container.item(id, pk).read().",
      sqlPattern: "SELECT * FROM c WHERE c.pk = @pk AND c.status = 'inbox' ORDER BY c.createdAt DESC",
      ruImpact: "Single-partition query costs 2.5 - 4.0 RUs. Cross-partition fan-out query costs 30 - 250+ RUs!"
    },
    {
      title: "2. The Change Feed Materialized View Pattern (The True Cosmos GSI)",
      concept: "Querying by Secondary Dimensions (e.g. Sender or ThreadId globally)",
      recommendation: 
        "When you must query across all mailboxes (e.g. 'Show all emails sent by X' or 'Find thread #1234 across departments'), " +
        "do NOT run an unpartitioned query. Instead, use an Azure Function or Cloudflare Worker listening to the Cosmos DB Change Feed " +
        "to project a denormalized replica into a secondary container (e.g. 'emails_by_sender' partitioned by '/sender' or 'threads' partitioned by '/threadId').",
      ruImpact: "Transforms an expensive 100+ RU cross-partition scan into a clean 2.8 RU single-partition point lookup."
    },
    {
      title: "3. Synthetic Partition Keys for Multi-Domain Scale",
      concept: "Logical Partition Limit (20 GB per partition key)",
      recommendation: 
        "If a shared department like 'help' receives 500,000 emails per year, a single partition could reach the 20 GB limit. " +
        "Use a synthetic partition key combining domain and month: 'help_housika.co.ke_2026-09'.",
      exampleJson: {
        id: "msg_908123",
        pk: "help_housika.co.ke_2026-09",
        department: "help",
        domain: "housika.co.ke",
        receiver: "help@housika.co.ke"
      },
      ruImpact: "Guarantees infinite horizontal scaling while keeping single-partition reads within a date window."
    },
    {
      title: "4. Store Binary Data and Large MIME in Cloudflare R2, Not Cosmos DB",
      concept: "Document Size & RU Economy",
      recommendation: 
        "Keep Cosmos DB documents under 4 KB (storing headers, text preview, status, attribution, attachment metadata). " +
        "Store the raw MIME (.eml) and attachments in Cloudflare R2 object storage. Cosmos DB point read under 1 KB costs exactly 1.0 RU.",
      ruImpact: "Reduces Cosmos DB write RU from 25+ RU down to 5.5 RU per email saved."
    }
  ]
};
