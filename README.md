# OpsAI Platform

**AI-powered Decision Support System** for industrial operations. Converts expert knowledge into actionable operational intelligence through an intuitive chat interface with RAG-powered insights from company data.

[![Status][status]][status-url] [![License][license]][license-url]

## 🚀 Features

- **Chat Interface**: Natural language queries for technical analysis, well diagnostics, process optimization, and procedural guidance
- **Knowledge Base Dashboard**: Live inventory of structured/unstructured files, processing status, and auto-curation progress
- **Executive Dashboards**: Real-time KPIs, ROI metrics, operational health monitoring
- **Modular Architecture**: Oil & Gas modules with easy expansion to Mining, Manufacturing, Utilities
- **RAG Pipeline**: Automatic ingestion of manuals, historical cases, lessons learned, and real-time operational data

## 🛠 Tech Stack

```
Frontend: Electron.js (Desktop-first SaaS)
Backend: Node.js + TypeScript
AI: RAG engine (company data + external sources)
Database: Vector DB + PostgreSQL
Deployment: Docker containers
```

## 🎯 Core Value Proposition

**Every operational decision backed by your company's complete knowledge base + industry benchmarks.** 
- Reduce diagnostic time by 70%
- Eliminate repetitive operational errors  
- Scale senior expertise across all field teams
- Measure ROI in operational efficiency

## 📱 User Interface

```
Main Flow:
├── Chat: "Analyze well X034 - 15% production drop" → Instant diagnosis + recommendations
├── KB Dashboard: Structured files (245) | Processing (17) | Upload new data
├── Exec Dashboard: Field KPIs | Cost savings | System health
└── Knowledge Graph: Visual relationships between procedures/cases/assets
```

## 🏗 Project Structure

```
ops-ai-platform/
├── src/
│   ├── main/         # Electron main process
│   ├── renderer/     # UI components (React/Vue/Svelte)
│   ├── core/         # RAG engine, AI services
│   ├── modules/      # oil-wells/, facilities/, training/
│   └── data/         # Pipelines, vector store
├── docs/             # API, deployment guides
├── docker/           # Containerization
└── tests/            # E2E + unit
```

## 🚀 Quick Start (Development)

```bash
# Clone & install
git clone https://github.com/fegloff/ops-ai-platform.git
cd ops-ai-platform
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## 📈 Roadmap

- [ ] **Phase 1**: Oil & Gas MVP (Well diagnostics + Facilities)
- [ ] **Phase 2**: Knowledge Base + RAG pipeline  
- [ ] **Phase 3**: Multi-industry modules (Mining, Gas)
- [ ] **Phase 4**: SaaS cloud deployment + analytics

## 🤝 Contributing

1. Fork the repo
2. Create feature branch (`git checkout -b feature/well-analysis`)
3. Commit changes (`git commit -m 'Add well diagnostic module'`)
4. Push & PR

## 📄 License

MIT License - see [LICENSE](LICENSE) file.
