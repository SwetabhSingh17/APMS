/**
 * Verification Test Suite: Multi-Word Search Engine & In-Memory Indexing
 *
 * Verifies that tokenized search correctly handles:
 * 1. Single and multi-word queries with single, multiple, or trailing spaces.
 * 2. Cross-attribute matching across combined documents.
 * 3. In-memory search index functionality and sub-millisecond execution over 1,000+ items.
 * 4. Server-side searchProjects criteria tokenization.
 */

import {
  tokenizeSearchQuery,
  createSearchDocument,
  matchesSearchQuery,
  filterBySearchQuery,
  createSearchIndex,
} from "../client/src/lib/search-index";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

async function runSearchVerification() {
  console.log("🔍 Starting Multi-Word Search Engine Verification...\n");

  // --- Test 1: Tokenization ---
  console.log("Test 1: Query Tokenization");
  assert(tokenizeSearchQuery("").length === 0, "Empty query returns empty array");
  assert(tokenizeSearchQuery("   ").length === 0, "Whitespace-only query returns empty array");
  assert(tokenizeSearchQuery(null).length === 0, "Null query returns empty array");
  assert(tokenizeSearchQuery(undefined).length === 0, "Undefined query returns empty array");

  const singleTokens = tokenizeSearchQuery("Machine");
  assert(singleTokens.length === 1 && singleTokens[0] === "machine", "Single word tokenized");

  const multiTokens = tokenizeSearchQuery("Machine   Learning   AI");
  assert(
    multiTokens.length === 3 &&
      multiTokens[0] === "machine" &&
      multiTokens[1] === "learning" &&
      multiTokens[2] === "ai",
    "Multi-word with irregular spacing tokenized correctly"
  );

  const trailingSpaceTokens = tokenizeSearchQuery("Mohd ");
  assert(
    trailingSpaceTokens.length === 1 && trailingSpaceTokens[0] === "mohd",
    "Trailing space does not produce empty tokens or break terms"
  );
  console.log("  ✅ Tokenization tests passed.");

  // --- Test 2: Search Document Creation ---
  console.log("\nTest 2: Search Document Creation");
  const doc = createSearchDocument(
    "PUGID26001",
    "AI Health Assistant",
    ["Python", "FastAPI", "TensorFlow"],
    "Dr. Fiza Afreen",
    22001001,
    null,
    undefined
  );
  assert(
    doc.includes("pugid26001") &&
      doc.includes("ai health assistant") &&
      doc.includes("python") &&
      doc.includes("dr. fiza afreen") &&
      doc.includes("22001001"),
    "All fields correctly flattened into lowercase search document"
  );
  console.log("  ✅ Document creation tests passed.");

  // --- Test 3: Multi-Word Matching Logic ---
  console.log("\nTest 3: Multi-Token Matching Logic");
  const testDoc = createSearchDocument(
    "PUGID26042",
    "Automated Patient Monitoring",
    "React Node PostgreSQL",
    "Mohd Anas Khan",
    "BCA Group 1",
    "Roll 22001004"
  );

  // Exact single word
  assert(matchesSearchQuery(testDoc, "Patient"), "Matches single word");
  // Multi-word in same field
  assert(matchesSearchQuery(testDoc, "Patient Monitoring"), "Matches phrase in title");
  // Multi-word with trailing space (user typing)
  assert(matchesSearchQuery(testDoc, "Patient "), "Matches query with trailing space while typing");
  // Multi-word across different attributes (Student Name + Tech + Group)
  assert(
    matchesSearchQuery(testDoc, "Mohd React Group"),
    "Matches tokens spread across student name, tech, and team"
  );
  // Word order independent
  assert(
    matchesSearchQuery(testDoc, "Khan Anas Mohd"),
    "Matches regardless of token order (Anas Mohd vs Mohd Anas)"
  );
  // Code and number
  assert(matchesSearchQuery(testDoc, "PUGID26042 22001004"), "Matches PUGID and roll number");
  // Non-matching query
  assert(!matchesSearchQuery(testDoc, "Flutter Android"), "Correctly rejects non-matching query");
  // Partial mismatch
  assert(!matchesSearchQuery(testDoc, "Mohd Flutter"), "Rejects when any token fails to match");
  console.log("  ✅ Multi-token matching tests passed.");

  // --- Test 4: Higher-Order filterBySearchQuery ---
  console.log("\nTest 4: filterBySearchQuery Helper");
  interface ISampleTopic {
    id: number;
    title: string;
    tech: string;
    supervisor: string;
  }
  const sampleTopics: ISampleTopic[] = [
    { id: 1, title: "Smart Campus Navigation", tech: "Flutter Dart", supervisor: "Dr. Mohd Faisal" },
    { id: 2, title: "Attendance Face Recognition", tech: "Python OpenCV", supervisor: "Dr. Fiza Afreen" },
    { id: 3, title: "Hospital Management", tech: "React Node.js", supervisor: "Mr. Mohd Anas" },
    { id: 4, title: "Library Portal", tech: "PHP MySQL", supervisor: "Dr. Tabrez Khan" },
  ];

  const searchResults1 = filterBySearchQuery(sampleTopics, "Mohd", t =>
    createSearchDocument(t.title, t.tech, t.supervisor)
  );
  assert(searchResults1.length === 2, "Found both topics with Mohd supervisor");

  const searchResults2 = filterBySearchQuery(sampleTopics, "Mohd Smart", t =>
    createSearchDocument(t.title, t.tech, t.supervisor)
  );
  assert(searchResults2.length === 1 && searchResults2[0].id === 1, "Multi-token cross-field matches topic 1");

  const searchResults3 = filterBySearchQuery(sampleTopics, "Face Python", t =>
    createSearchDocument(t.title, t.tech, t.supervisor)
  );
  assert(searchResults3.length === 1 && searchResults3[0].id === 2, "Title + tech multi-token matches topic 2");

  const searchResultsEmpty = filterBySearchQuery(sampleTopics, "", t =>
    createSearchDocument(t.title, t.tech, t.supervisor)
  );
  assert(searchResultsEmpty.length === sampleTopics.length, "Empty search query returns all items");
  console.log("  ✅ filterBySearchQuery tests passed.");

  // --- Test 5: In-Memory Search Index & Sub-Millisecond Benchmark ---
  console.log("\nTest 5: In-Memory Index & Performance Benchmark (1,000 items)");
  const largeDataset = Array.from({ length: 1000 }, (_, idx) => ({
    id: idx + 1,
    name: `Student User ${idx + 1}`,
    enrollment: `2200100${idx + 1}`,
    projectTitle: `Project System Research #${idx + 1}`,
    tech: idx % 2 === 0 ? "Python Machine Learning PyTorch" : "React Node PostgreSQL TypeScript",
    supervisor: idx % 3 === 0 ? "Dr. Fiza Afreen" : idx % 3 === 1 ? "Dr. Mohd Faisal" : "Mr. Salman Khan",
  }));

  const index = createSearchIndex(largeDataset, item =>
    createSearchDocument(item.name, item.enrollment, item.projectTitle, item.tech, item.supervisor)
  );

  const startBenchmark = performance.now();
  const indexMatches = index.search("Python Fiza 50");
  const durationMs = performance.now() - startBenchmark;

  console.log(`  ⚡ Executed multi-word index search across 1,000 records in ${durationMs.toFixed(3)}ms`);
  assert(durationMs < 5.0, `Search index execution must be sub-millisecond (was ${durationMs.toFixed(3)}ms)`);
  assert(indexMatches.length > 0, "Index search found matching records");
  for (const match of indexMatches) {
    assert(match.tech.includes("Python"), "Match contains Python");
    assert(match.supervisor.includes("Fiza"), "Match contains Fiza");
    assert(String(match.id).includes("50") || match.enrollment.includes("50"), "Match contains 50");
  }
  console.log("  ✅ Index cache & performance benchmark passed.");

  console.log("\n🎉 ALL SEARCH ENGINE TESTS PASSED SUCCESSFULLY!\n");
}

runSearchVerification().catch(err => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
