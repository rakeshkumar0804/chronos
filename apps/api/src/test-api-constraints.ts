process.env.NODE_ENV = "test";
import { Server } from "http";
import type { Express } from "express";

async function testApiEndpoint() {
  console.log("=================================================");
  console.log("Testing API Endpoint: POST /api/constraints/parse");
  console.log("=================================================\n");

  const mod = await import("./index.js");
  const app: any = mod.default;
  const server: Server = app.listen(4005);

  try {
    const testPayloads = [
      {
        name: "Valid Faculty Leave",
        body: { text: "Prof. Chetan Prasad is on leave on Thursday and Friday" },
        expectedStatus: 200,
      },
      {
        name: "Valid Room Maintenance",
        body: { text: "Lab 302 is closed on Monday and Tuesday morning" },
        expectedStatus: 200,
      },
      {
        name: "Hallucinated Entity",
        body: { text: "Prof. Alex Whitmore is unavailable on Friday" },
        expectedStatus: 422,
      },
      {
        name: "Empty Request Body",
        body: { text: "" },
        expectedStatus: 400,
      },
    ];

    for (const test of testPayloads) {
      console.log(`Sending: ${test.name} -> Body: ${JSON.stringify(test.body)}`);
      const response = await fetch("http://localhost:4005/api/constraints/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(test.body),
      });

      const data = await response.json();
      const statusMatch = response.status === test.expectedStatus;
      console.log(`Status: ${response.status} (Expected: ${test.expectedStatus}) - ${statusMatch ? "✅ PASS" : "❌ FAIL"}`);
      console.log(`Response:`, JSON.stringify(data, null, 2));
      console.log("-------------------------------------------------");

      if (!statusMatch) {
        throw new Error(`Endpoint test failed on ${test.name}`);
      }
    }

    console.log("\nAll API Endpoint integration tests passed successfully!\n");
  } finally {
    server.close();
  }
}

testApiEndpoint().catch((e) => {
  console.error(e);
  process.exit(1);
});
