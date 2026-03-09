# OpsAI Platform

## What This Is

An AI-powered decision support desktop application for industrial operations (Oil & Gas focused). Provides a Claude/OpenAI-style chat interface that answers questions and provides operational guidance by reasoning over uploaded company documents, industry standards, and best practices using RAG technology. Targeted at subscription-based SaaS delivery with tenant isolation and custom branding per client.

## Core Value

**Every operational decision backed by your company's complete knowledge base + industry benchmarks.**

## Requirements

### Validated

(None yet — ship to validate)

### Active

#### MVP Phase 1 (Sellable MVP)

- **Authentication & Multi-tenancy**
  - User can sign up with email/password
  - User can log in and stay logged in across sessions
  - System enforces tenant isolation (users only see their company's data)
  - Tenant branding: logo, colors, and "Powered by Ops AI Platform" attribution

- **Chat Interface (Core Experience)**
  - User can open chat interface with natural language input
  - System displays responses with citations/references to source documents
  - System provides both Q&A and step-by-step operational guidance
  - Chat maintains conversation history within session
  - User can start new chat conversations
  - User can view past conversations
  - System comes with pre-loaded industry sample documents for immediate demo value

- **Document Management (Basic)**
  - User can upload documents (PDF, DOCX, TXT, etc.)
  - System processes uploaded documents into the RAG pipeline
  - User sees processing status (queued, processing, indexed, error)
  - Documents become available for chat queries once indexed
  - User can list all uploaded documents
  - User can delete documents

- **RAG Pipeline**
  - System automatically chunks and embeds documents
  - Vector search retrieves relevant context for queries
  - LLM generates responses grounded in retrieved context
  - Citations link back to source documents

#### Phase 2 (Post-MVP Enhancements)

- Knowledge Base Dashboard with advanced filtering, bulk operations, and analytics
- Project/workspace concept for organizing documents and chats
- Shared projects and collaborative chat sessions
- Export chat logs and conversations
- Advanced document processing (tables, images, OCR)
- User role management (admin vs regular user)

#### Future Phases

- SSO integration (OAuth, SAML) for enterprise clients
- Advanced analytics and executive dashboards
- Real-time data integration (live production data feeds)
- Multi-industry modules (Mining, Manufacturing, Utilities)

### Out of Scope

- **SSO authentication** — deferred to enterprise contracts (email/password for MVP)
- **Multi-user collaboration** — single-user experience first, shared projects later
- **Advanced admin panel** — basic document management only in MVP
- **Mobile applications** — desktop-first (Electron)
- **Real-time operational data** — document-based RAG only in MVP
- **Custom LLM fine-tuning** — use off-the-shelf models with RAG
- **Offline mode** — requires internet connectivity

## Context

**Domain:** Oil & Gas production optimization. The platform helps field operators, engineers, and managers make better decisions by instant access to institutional knowledge, industry standards, and best practices.

**Technical Stack:**
- Frontend: Electron.js (Desktop-first SaaS)
- Backend: Node.js + TypeScript
- AI: RAG engine using Claude/OpenAI + company documents
- Database: Vector DB (for embeddings) + PostgreSQL (for metadata, users, tenants)
- Deployment: Docker containers

**Commercial Model:** Subscription-based SaaS. Multi-tenant architecture from day one to support multiple paying clients with isolated data. Per-tenant branding allows white-label feel.

**Demo Strategy:** MVP ships with pre-loaded sample documents (API standards, production optimization guides, common diagnostic procedures) so prospects can immediately experience value without needing to bring their own documents.

## Constraints

- **Time to market:** MVP must be demonstrable within weeks, not months
- **Multi-tenancy:** Data isolation and tenant branding from initial architecture
- **Desktop app:** Electron for ease of distribution and file system access
- **RAG correctness:** Responses must cite sources; avoid hallucinations
- **Demo-ready:** Sample data included out of the box

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Email/password auth for MVP | Simpler, faster; SSO as enterprise add-on | Defer SSO |
| Single-user chat first | Validate core value before collaboration | Phase 2+ |
| Include demo documents | Show immediate value in sales demos | Ship with sample data |
| Electron desktop app | Easy distribution, file access, native feel | Desktop-first |

---

*Last updated: 2026-03-08 after initialization*
