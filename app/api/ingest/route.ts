import { NextRequest, NextResponse } from "next/server";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { Document } from "@langchain/core/documents";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, filename } = body;

    if (!text) {
      return NextResponse.json({ error: "No text provided for ingestion" }, { status: 400 });
    }

    // 1. Split text into chunks
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
    });

    const docs = [
      new Document({
        pageContent: text,
        metadata: { source: filename || "Uploaded Document" },
      }),
    ];
    const splitDocs = await splitter.splitDocuments(docs);

    // 2. Initialize Gemini Embeddings (768 dimensions)
    const embeddings = new GoogleGenerativeAIEmbeddings({
      model: "embedding-001",
      apiKey: process.env.GEMINI_API_KEY,
    });

    // 3. Connect to Supabase Postgres vector store
    const vectorStore = await PGVectorStore.initialize(embeddings, {
      postgresConnectionOptions: { connectionString: process.env.DATABASE_URL },
      tableName: "documents",
    });

    // 4. Save chunks and embeddings to database
    await vectorStore.addDocuments(splitDocs);

    return NextResponse.json({
      success: true,
      message: `Successfully ingested ${splitDocs.length} chunks from ${filename || "document"}!`,
    });
  } catch (error: any) {
    console.error("Ingestion error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}