# Domain Pitfalls: Industrial RAG Platform - Oil & Gas Production Optimization

**Domain:** Industrial RAG platform for Oil & Gas production optimization
**Researched:** 2026-03-08
**Confidence:** HIGH - Based on RAG failure patterns, multi-tenant SaaS incidents, and industrial AI deployment experiences

---

## CRITICAL PITFALLS

These cause rewrites, data breaches, or make the product unusable.

### Pitfall 1: Multi-Tenant Data Leakage Through Vector Search

**What goes wrong:** One tenant's documents appear in another tenant's search results. This is catastrophic for SaaS credibility and violates contract obligations. The most common failure mode: tenant isolation at the metadata level but NOT at the vector embedding level.

**Why it happens:**
- Vector database lacks proper tenant-scoping on embeddings
- Shared vector index across tenants without filtering
- Query construction that doesn't include tenant_id filter
- Caching layer serves cross-tenant results
- Backup/restore operations mix tenant data

**Consequences:**
- Immediate loss of customer trust
- GDPR/regulatory violations (data residency requirements)
- Legal liability and contract breaches
- Product becomes unsellable in regulated industries

**Warning signs (detection):**
- Users reporting documents from other companies in their search
- QA tests pass with mock data but fail with real multi-tenant data
- Vector database queries don't include tenant_id filter
- Single vector database instance without tenant separation strategy

**Prevention:**
- **Architecture decision (Phase 0):** Implement tenant isolation at EVERY layer:
  - Database: Tenant-scoped vector collections (separate collection per tenant OR tenant_id metadata field with mandatory filter)
  - Backend: Tenant context injected into ALL queries from auth middleware
  - Vector DB: Configure tenant_id as required filter (not optional)
- **Testing (Phase 1):** Build automated cross-tenant leakage tests that try to retrieve data from wrong tenant
- **Audit (Ongoing):** Log all vector queries with tenant_id and verify tenant consistency
- **Database design:** Use separate vector index namespaces per tenant for stronger isolation

**Phase to address:** Architecture phase (before coding) and continuous testing through all phases

---

### Pitfall 2: Document Processing Fails on Real Technical Documents

**What goes wrong:** PDF upload succeeds but RAG can't extract meaningful content. Users upload technical documents with tables, diagrams, embedded images, and multi-column layouts. The system extracts garbled text or nothing, making documents invisible to RAG. Documents appear "indexed" but provide zero retrieval value.

**Why it happens:**
- Using naive PDF extractors (pdf-text, basic OCR) that fail on complex layouts
- No handling of tables (structured data lost)
- Diagrams and images ignored without captions/descriptions
- Multi-column magazine-style layouts read in wrong order
- Equations and chemical formulas rendered as gibberish
- Scanned documents with poor OCR quality
- Font encoding issues (common in technical specs)

**Consequences:**
- Users think system is broken ("I uploaded 50 documents and got no answers")
- Support tickets flood in
- Pre-loaded demo documents fail to show value
- Time-to-value stretches from minutes to weeks as users manually extract text

**Warning signs:**
- Processing "succeeds" but retrieved chunks are nonsensical
- Documents with tables produce poor search results
- PDFs from industry standards (API specs, ASTM standards) fail
- High document count but low query hit rate

**Prevention:**
- **Document processing stack (Phase 1):**
  - Use specialized document understanding: Azure Document Intelligence, AWS Textract, or open-source alternatives (DocTR, LayoutLM)
  - Support for table extraction with structure preservation
  - OCR fallback for scanned documents with quality validation
  - Layout-aware chunking: detect columns, headers, footers
- **Validation:** Reject documents with extraction confidence <80% and show user what was extracted before indexing
- **Demo documents:** Choose sample documents that are extraction-friendly (not scanned, well-formatted)
- **User education:** Clearly communicate document format requirements
- **Metrics:** Track document-to-retrieval success rate per document (not just upload success)

**Phase to address:** Phase 1 (MVP document processing) - must handle real industrial docs

---

### Pitfall 3: RAG Hallucinations with Insufficient Context

**What goes wrong:** LLM generates confident, plausible-sounding but incorrect answers when retrieved context is insufficient. Worse: system presents hallucinations with fake citations (cites document X that wasn't even retrieved). Users trust the system because it sounds authoritative and has citation markers.

**Why it happens:**
- Threshold for "enough context" is too low (system generates even with 1 irrelevant chunk)
- No detection of context-requery mismatch
- LLM prompt doesn't enforce "if not in context, say so"
- Citation generation post-process that fabricates references
- Over-reliance on LLM's parametric memory instead of retrieved context

**Consequences:**
- Operators make wrong decisions based on false information
- Safety procedures cited incorrectly → potential accidents
- Regulatory compliance claims are wrong → legal violations
- Users lose trust when they spot hallucinations

**Warning signs:**
- LLM generates answers for queries with zero relevant chunks retrieved
- Citations point to documents not in retrieved context
- Answers contain details not present in ANY uploaded document
- Confidence scores don't correlate with actual grounding

**Prevention:**
- **Prompt engineering (Phase 1):** Hard constraint: "Answer ONLY using the provided context. If context doesn't contain the answer, say 'I cannot answer based on the available documents.' DO NOT invent information."
- **Context quality threshold:** Require minimum similarity score (e.g., 0.75) AND minimum number of relevant chunks (e.g., 2) before permitting answer generation
- **Citation validation:** Post-process: citations MUST come from retrieved chunks. Strip citation markers if no valid source
- **Answer validation pipeline:** Compare generated answer against retrieved chunks; flag contradictions
- **User-facing guardrails:** Show "Sources found: 3" vs "No relevant sources" differently. Don't allow answer when sources insufficient.
- **Industry-specific:** For safety-critical procedures (lockout/tagout, emergency shutdown), require exact match to official procedure document; no paraphrasing allowed

**Phase to address:** Phase 1 (MVP RAG pipeline) and ongoing refinement

---

### Pitfall 4: Chunking Strategy Destroys Document Context

**What goes wrong:** Documents are chopped arbitrarily (by tokens or fixed size) breaking apart related information. Critical information spans chunk boundaries: procedure step 1 in chunk A, step 2 in chunk B, table in chunk C. Retrieval only gets partial picture → incomplete or wrong answers.

**Why it happens:**
- Using naive fixed-size chunking (e.g., 512 tokens) without semantic awareness
- Not respecting document structure (headings, sections, tables)
- Sentences cut in half mid-thought
- Tables split across multiple chunks
- No overlap between chunks → loss of continuity

**Consequences:**
- Multi-step procedures incomplete → operational errors
- Tables referenced but not fully retrieved
- Definitions and explanations separated from examples
- System fails on documents with cohesive narrative flow

**Warning signs:**
- Queries about procedures return only partial steps
- Table-related questions fail even though table exists in document
- Retrieval hits many chunks but still missing key information
- Document-to-chunk mapping shows breaks at awkward points

**Prevention:**
- **Chunking strategy (Phase 1):** Use semantic-aware chunkers:
  - Markdown/HTML-aware: respect headings, lists, tables
  - Character-based but respect sentence boundaries
  - Overlap strategy: 10-20% token overlap between adjacent chunks
  - Table handling: extract tables as separate chunks with metadata linking to surrounding text
  - Hierarchical chunking: store both small (fine-grained) and large (coarse) chunks
- **Domain-specific tuning:** For technical documents with numbered procedures: detect numbered sequences and keep them together
- **Validation:** Sample 20 documents; manually verify chunks preserve semantic integrity
- **Iterative improvement:** Log failed queries where information exists but wasn't retrieved; adjust chunking accordingly

**Phase to address:** Phase 1 (RAG pipeline design) - chunking affects everything downstream

---

### Pitfall 5: Desktop (Electron) Security Vulnerabilities

**What goes wrong:** Electron app packaged for desktop distribution has security holes: hardcoded API keys, local storage leaks, JavaScript injection via document uploads, or reverse engineering exposes backend endpoints and tenant structure.

**Why it happens:**
- Treating Electron as "just a browser" and applying web security practices insufficient for desktop distribution
- API keys/endpoints embedded in client bundle (easy to extract)
- localStorage or IndexedDB storing sensitive session data unencrypted
- No protection against tampering or debugging
- Auto-update mechanism not signed/secured
- File system access too broad (can read user's entire home directory)

**Consequences:**
- Attackers discover API endpoints and launch attacks
- Tenant enumeration via visible IDs
- Session hijacking from extracted tokens
- Reverse engineering reveals architecture → targeted attacks
- Compliance audit failure (SOC2, ISO27001)

**Warning signs:**
- API endpoints visible in network tab or packed JS
- "Run in development mode" accessible in production builds
- Unencrypted sensitive data in local storage
- No code signing or update signing
- Electron version outdated with known vulnerabilities

**Prevention:**
- **Electron security hardening (Phase 1):**
  - Use `contextIsolation: true`, `nodeIntegration: false`
  - Never embed secrets in client; use backend-as-proxy
  - Code signing for both app and auto-updates
  - Encrypt sensitive data in localStorage/IndexedDB
  - Disable remote module loading
  - Content Security Policy (CSP) headers
  - Enable electron-builder security hardening flags
  - Regular security audit with `electron-notarize` and security scanners
- **Backend design:** All AI/LLM calls made from backend, never client-side
- **Distribution:** Sign binaries, use Squirrel or equivalent secure update framework
- **Penetration testing:** Include in pre-launch checklist

**Phase to address:** Phase 1 (MVP desktop deployment) - security must be baked in

---

### Pitfall 6: Lack of RAG Evaluation and Monitoring

**What goes wrong:** Team has no way to measure if RAG quality is improving or degrading. Success defined by "users seem happy" rather than concrete metrics. When quality drops (due to new document types, updated models, or chunking changes), it goes undetected until major incident.

**Why it happens:**
- No evaluation dataset of query-answer pairs
- No automated testing before deploying RAG changes
- No monitoring of retrieval precision/recall in production
- No user feedback mechanism to capture wrong answers
- Ignoring that RAG quality varies by document type and query type

**Consequences:**
- Quality regressions ship unnoticed
- Can't A/B test improvements
- Don't know which document types or queries fail
- Support can't triage user complaints without context
- Months later: "the AI used to work better"

**Warning signs:**
- No evaluation dataset exists
- Releases include RAG changes but no evaluation run
- No production metrics on retrieval scores or answer grounding
- User feedback not collected or analyzed
- Team can't answer "what's our retrieval precision?"

**Prevention:**
- **Evaluation framework (Phase 1):**
  - Build gold dataset: 100+ query-answer pairs with known correct answers and source documents
  - Define metrics: retrieval precision@5, answer similarity (ROUGE/BERTScore), hallucination rate, citation accuracy
  - Automated CI/CD: Run evaluation on every RAG change; block deployment if metrics drop >5%
  - Include edge cases: tables, multi-step procedures, safety questions
- **Production monitoring (Phase 1+):**
  - Track per-query: retrieval score, context length, answer length, user feedback
  - Alert on: sudden increase in "no answer" responses, drop in average retrieval score
  - Log LLM prompts and responses for debugging (PII-anonymized)
- **User feedback loop:** Simple thumbs up/down on answers; collect "wrong answer" reports with correction
- **Regulatory:** For safety-critical domains, maintain audit trail of queries and answers

**Phase to address:** Phase 1 (MVP evaluation) and continuous improvement

---

### Pitfall 7: Ignoring Context Window Limitations

**What goes wrong:** Documents are long (100+ pages of standards, spec sheets). System tries to fit entire documents into context window, causing truncation, or uses insufficient chunks providing incomplete picture. System either fails with context overflow or provides fragmented answers.

**Why it happens:**
- Not realizing LLM context window is finite (even large ones like 200K tokens)
- Naive approach: dump all retrieved chunks into context → overflow or truncation
- No strategy for selecting most relevant chunks within window limit
- Not using hierarchical retrieval (get summary first, then drill)
- Long documents not processed into multi-level representations

**Consequences:**
- Important information truncated before it reaches LLM
- User asks "what does section 5 say?" but system only processed up to section 3
- Performance degrades as context grows (slower, more expensive)
- Answers become shallow because context consumed by irrelevant chunks

**Warning signs:**
- Queries about later sections of long documents fail
- Many chunks retrieved but long document questions still fail
- Context token count approaching or exceeding model limit
- Performance degrades with more documents indexed

**Prevention:**
- **Context window strategy (Phase 1):**
  - Know your model's context limit (Claude: 200K, GPT-4: 128K, others vary)
  - Implement smart chunk selection: rank by relevance, take top-N that fit
  - Use smaller chunk size (e.g., 512 tokens) with high overlap → better selection granularity
  - Implement re-ranking: retrieve 50 candidates, re-rank top 10 that fit in context
  - For multi-part questions: sequential retrieval (answer part 1, then use that to query part 2)
- **Long document strategy:**
  - Generate document-level summaries during indexing (separate embedding)
  - Hierarchical chunks: small (paragraph), medium (section), large (document)
  - Query routing: detect if question needs broad document context vs specific detail
- **Monitoring:** Alert when context utilization >80%

**Phase to address:** Phase 1 (RAG pipeline) - critical for technical standards documents

---

### Pitfall 8: Chat UX Issues: No Citation Transparency

**What goes wrong:** Users see answer with citation "[Document: API Spec v2.1]" but can't tell which chunk it came from, can't verify the quote, can't navigate to source. When citations are wrong or misleading, users have no way to fact-check. The system feels like a black box.

**Why it happens:**
- Citations point to document metadata only, not specific page/section
- No highlighting of exact text used in answer
- Clicking citation doesn't show source context
- Multiple queries cited from same document but different parts not distinguished
- Users can't distinguish "this came from page 3" vs "page 42"

**Consequences:**
- User distrust ("where did it get this?")
- Can't verify correctness → reliance on faith
- Regulatory audit: can't prove answer grounded in actual document
- Support burden: "show me where it says that"

**Warning signs:**
- User complaints: "I can't find where it said that"
- Citation only shows document title, no location
- No "view source" or "highlight in document" feature
- Multiple answers cite same document without specificity

**Prevention:**
- **Citation design (Phase 1):**
  - Citations MUST include: document name, section heading/page number, chunk preview snippet
  - Clicking citation shows: full source chunk highlighted, surrounding context (pre/post chunks)
  - Quote actual text from source in answer (in quote block) and cite specifically
  - Differentiate citations: if 3 chunks from same document used, show [Doc A §4.2], [Doc A §7.1], etc.
- **UX requirement:** Every answer shows "Based on X documents" with expandable citations
- **Verification feature:** "Verify this answer" button that shows exact matching text between source and answer
- **Audit log:** Store exact chunks used per query for compliance

**Phase to address:** Phase 1 (Chat interface MVP) - core to user trust

---

### Pitfall 9: Missing Relevance Feedback Loop

**What goes wrong:** System never learns from user behavior. If users consistently ignore retrieved results from certain document types or always re-query differently, system doesn't adapt. RAG quality stagnates while user needs evolve.

**Why it happens:**
- No capture of implicit feedback (did user ask follow-up? rephrase? click source?)
- No A/B testing framework for RAG improvements
- Models and chunking strategies frozen after MVP
- Assuming "works on demo data" means "works in production"

**Consequences:**
- RAG performance plateaus below acceptable levels
- Users grind improvements manually (learn system quirks)
- Competitive disadvantage as others iterate
- Major re-write needed 6 months later when complaints overwhelm

**Warning signs:**
- No feedback collected beyond explicit thumbs up/down
- No queries-to-documents mapping for relevance analysis
- Development focused on new features, not RAG quality
- "We'll improve AI later" → never happens

**Prevention:**
- **Feedback capture (Phase 1):**
  - Implicit: Does user ask follow-up? rephrase within 60 seconds? (good)
  - Implicit: Does user click citation? How long viewed? (engagement)
  - Explicit: Thumbs up/down on answer
  - Explicit: "Report incorrect answer" with correction field
- **Analytics dashboard (Phase 2):**
  - Query success rate (answered vs no-answer)
  - Document hit rate (what % of indexed documents ever retrieved)
  - User satisfaction trends
  - Top failing query patterns
  - Per-document retrieval statistics
- **Continuous improvement:**
  - Weekly review of failed queries
  - Quarterly re-training of embedding models on domain-specific data
  - A/B testing framework Phase 2+
- **Embedding fine-tuning:** Use user feedback to fine-tune embedding model on industrial domain (Phase 2)

**Phase to address:** Phase 1 (MVP feedback) → Phase 2 (analytics & improvement)

---

### Pitfall 10: Regulatory Compliance Blind Spots

**What goes wrong:** Industrial operations subject to strict regulations (OSHA, EPA, API standards). System provides guidance that needs to be certified or compliant. But RAG can't guarantee compliance statements are accurate or up-to-date. Lack of audit trail means can't prove what information was provided to operators.

**Why it happens:**
- No versioning of source documents (regulation updates)
- No way to prove which document version was cited
- LLM paraphrasing changes meaning of regulatory text
- No human-in-the-loop for safety-critical answers
- Can't generate compliance reports "what did we tell operators about procedure X?"

**Consequences:**
- Regulatory violation during audit (can't prove compliance)
- Operator follows outdated procedure → incident
- Legal liability: "the AI told us to do it"
- Can't sell to regulated industries without compliance features

**Warning signs:**
- Source documents lack version numbers and dates
- No way to say "as of document version Y" in answers
- Answers paraphrase regulatory text without exact quotes
- No audit log of what was communicated to which user
- Compliance team not involved in RAG evaluation

**Prevention:**
- **Document versioning (Phase 1):**
  - Store source document metadata: version, date, effective dates
  - Do NOT allow document overwrites; versions append-only
  - Citations include version and effective date: "API Spec 6A v20, effective 2024-01-15"
- **Answer formatting for compliance:**
  - For regulatory/safety content: Quote EXACT text, no paraphrasing
  - Add disclaimer: "Based on document version X. Verify against current official version."
  - Flag answers as "informational only" vs "compliance-critical"
- **Audit trail (Phase 1+):**
  - Log: user, tenant, query, retrieved documents/chunks, answer, timestamp
  - Immutable audit log (can't delete/modify)
  - Retain audit logs per regulatory requirements (typically 3-7 years)
- **Compliance review workflow (Phase 2):**
  - Human review process for new document ingestion (certify it's authoritative)
  - Periodic re-verification of documents against official sources
  - Compliance dashboard showing what's been communicated
- **Legal consultation:** Involve compliance/legal team before Phase 1 MVP launch

**Phase to address:** Phase 0 (architecture) and Phase 1 (MVP compliance features)

---

## MODERATE PITFALLS

These cause poor UX, support burden, or make product feel unpolished.

### Pitfall 11: Token-Based Cost Explosion

**What goes wrong:** RAG queries consume too many tokens per query because context is too large or prompts inefficient. Costs balloon with usage, making SaaS model uneconomical. Users experience slow responses due to context size.

**Why it happens:**
- Using largest context window for every query (200K tokens × $0.03/query = unsustainable)
- No context optimization (include full documents instead of relevant chunks)
- Repetitive system prompts
- Including full chat history unnecessarily

**Consequences:**
- Gross margin negative on usage-based pricing
- Need to restrict features → competitive disadvantage
- Slow response times (>10 seconds) → poor UX

**Prevention:**
- Context budgeting: limit to 4-8K tokens for Q&A, 16-32K for complex analysis
- Smart retrieval: only include relevant chunks, not entire documents
- Prompt engineering: concise system prompts
- Caching frequent query patterns
- Cost monitoring per tenant → alert when abnormal usage

---

### Pitfall 12: Poor Performance with Technical Terminology

**What goes wrong:** General-purpose embedding models don't understand domain-specific terms (oilfield jargon, equipment names, chemical compounds). Search for "blowout preventer" doesn't match documents that say "BOP" or " Rams-type preventor." System fails on domain-specific queries.

**Why it happens:**
- Using off-the-shelf embedding model (text-embedding-ada-002, sentence-transformers) trained on general web corpus
- No domain adaptation or fine-tuning
- Acronyms and abbreviations not mapped (HSE = Health Safety Environment vs Home Subsea Equipment)
- Typos and variations in equipment names not handled

**Consequences:**
- Operators frustrated: "the system doesn't know basic oilfield terms"
- High rate of "no results found" for domain queries
- Users resort to Google instead of your system

**Prevention:**
- Phase 1: Add query expansion (synonyms, acronyms, common misspellings)
- Phase 2: Fine-tune embedding model on industrial corpus (Oil & Gas technical documents)
- Maintain domain-specific thesaurus for query rewriting
- Test with actual operator terminology (not general English)

---

### Pitfall 13: Demo Documents Don't Reflect Real Customer Value

**What goes wrong:** Demo documents chosen for convenience (easily parseable PDFs) not representative of real customer pain points. Demo impresses but real customer documents fail, causing perception mismatch and lost sales.

**Why it happens:**
- Choosing demo documents from "nice to have"而非"must have" categories
- Using public standards that are well-formatted, not internal company procedures
- Not testing demo documents through entire pipeline
- Demo documents reflect only one use case (e.g., procedure lookup) not full spectrum

**Consequences:**
- Prospects say "looks great but won't work with our messy documents"
- POC-to-paid conversion low
- Sales team overpromising based on demo that isn't representative

**Prevention:**
- Early customer discovery: identify TOP 3 pain points before building demo
- Demo documents must mirror actual expected customer document types (bad formatting, scanned, complex tables)
- Build demo from real anonymized customer documents if possible
- Test demo documents against failure modes (tables, scanning, etc.)

---

### Pitfall 14: Inadequate Error Handling and User Communication

**What goes wrong:** Document fails to process with technical error that user doesn't understand ("Embedding dimension mismatch"). User thinks system broken. Support tickets. No way to self-diagnose.

**Why it happens:**
- Error messages bubble up from backend without translation
- No user-friendly error classification (temporary vs permanent vs user-action-required)
- Processing failures silent (document stays "processing" forever)
- No logs accessible to users for debugging their own issues

**Consequences:**
- High support burden
- User frustration -> churn
- Lost productivity while waiting for support

**Prevention:**
- User-centric error messages: "Document format not supported. Supported formats: PDF (text-based), DOCX, TXT. Scanned PDFs need OCR."
- Status granularity: Queued, Processing, Indexed, Failed (with reason)
- Allow user to retry failed documents
- Admin panel to see processing queue and errors

---

## PHASE-SPECIFIC WARNINGS

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| **Architecture design** | Multi-tenant data leakage | Design tenant isolation at schema level before any code; implement mandatory tenant filters |
| **Document processing (Phase 1)** | Processing failures on real docs | Test with actual customer documents before MVP; use production-grade PDF parser |
| **RAG pipeline (Phase 1)** | Chunking destroys context | Choose semantic chunker; validate on technical documents; tables must be preserved |
| **Chat UX (Phase 1)** | Hallucinations with fake citations | Strict prompt engineering; citation validation; answer only if confident |
| **Evaluation (Phase 1)** | No way to measure quality | Build gold evaluation set before shipping; automated regression testing |
| **Electron deployment (Phase 1)** | Security vulnerabilities | Follow Electron security checklist; code signing; secret management |
| **Phase 2 enhancements** | Feature bloat before nailing RAG quality | Phase 2 should focus on RAG improvements, not adding features before quality |
| **Compliance considerations** | No audit trail | Implement logging from day 1 (cannot add retroactively); involve legal early |

---

## OVERARCHING PRINCIPLES

1. **Tenant isolation is non-negotiable** - design for failure; assume any leak is catastrophic
2. **Document quality is everything** - garbage in, garbage out. Process or reject.
3. **Citations must be verifiable** - users must be able to check the source
4. **Err on the side of "I don't know"** - false confident answers are worse than no answer
5. **Test with REAL documents** - synthetic/demo data masks failures
6. **Monitor everything** - you can't fix what you don't measure
7. **Security from day 1** - Electron and SaaS both expose attack surfaces
8. **Compliance by design** - audit trails and versioning can't be retrofitted

---

## SOURCES

**RAG Failure Modes:**
- RAG evaluation frameworks identify hallucination, retrieval failure, and context mismatch as top failure modes
- Industrial applications face additional challenges with technical documents and compliance requirements

**Multi-Tenant Security:**
- Multi-tenant SaaS breaches commonly occur at data isolation layer
- Shared database without tenant scoping leads to cross-tenant access
- Vector databases historically lack multi-tenancy features → requires custom implementation

**Document Processing:**
- Technical documents (engineering standards, regulatory docs) have complex layouts defeating naive PDF extraction
- Tables and diagrams require specialized extraction pipelines
- Industrial domain: chemical formulas, equations, equipment schematics

**Desktop Deployment:**
- Electron apps frequently expose secrets in bundled code
- Security hardening checklist widely published but often ignored
- Auto-update mechanisms must be signed to prevent MITM attacks

**RAG Quality:**
- Evaluation metrics crucial for production systems
- Without golden dataset, quality regressions undetected
- Retrieval precision/recall must be tracked continuously
