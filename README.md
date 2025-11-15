# Proof of Argentinean Experience

A decentralized application built for Devconnect that leverages [GenLayer](https://www.genlayer.com/) to evaluate and rank photos of Argentinean cultural experiences using AI-powered consensus.

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/luclopezcesan-7401s-projects/v0-da-pp-with-genlayer)

## Overview

**Proof of Argentinean Experience** is an application that allows users to upload photos of Argentinean cultural experiences (asado, mate, La Bombonera stadium, etc.), generate text descriptions, and use GenLayer's decentralized AI consensus to:

- **Evaluate** how "Argentinean" the content appears (scoring 0-100)
- **Generate** short, humorous messages in Spanish
- **Rank** photos in leaderboards by category (food, customs, sports, etc.)
- **Operate** in a decentralized and transparent manner, using GenLayer's consensus as a "digital court"

## What is GenLayer?

[GenLayer](https://www.genlayer.com/) is an AI-native trust layer and synthetic jurisdiction on-chain. It enables **trustless decision-making** through a decentralized network of validator nodes powered by diverse AI models that reach consensus on subjective decisions.

**Key Resources:**
- **Website:** [https://www.genlayer.com/](https://www.genlayer.com/)
- **Documentation:** [https://docs.genlayer.com/](https://docs.genlayer.com/)

## Why GenLayer?

This project leverages GenLayer's unique capabilities for subjective evaluation and decentralized consensus:

### 1. Trust, Transparency & Consensus
- The "jury" is not a central server but a network of AI validators
- Scoring doesn't depend on a single person → **reduced individual bias**
- All evaluations are transparent and verifiable on-chain

### 2. Non-Deterministic Evaluation with LLMs
- "How Argentinean is this?" doesn't have an exact answer
- LLMs combined with GenLayer's consensus are ideal for these types of **subjective judgments**
- The system can understand cultural context and nuance

### 3. Digital Court for Dispute Resolution
- When photos compete for ranking positions, disputes can be resolved:
  > "Between photo A and photo B, which is more culturally Argentinean?"
- This aligns perfectly with GenLayer's **dispute resolution** capabilities

### 4. Wisdom of the Crowd
- Multiple validators → multiple cultural perspectives → **less bias** from a single model
- The consensus mechanism aggregates diverse viewpoints for fairer evaluations

## Features

- 📸 **Photo Upload**: Upload images of Argentinean cultural experiences
- 🤖 **AI Analysis**: Automatic description generation and cultural evaluation
- 📊 **Scoring System**: 0-100 score based on cultural authenticity
- 🏆 **Leaderboards**: Rank photos by category (food, customs, sports, etc.)
- 💬 **Humorous Messages**: Generate fun, contextual Spanish messages
- 🔗 **Decentralized**: Powered by GenLayer's validator network
- ⚖️ **Transparent**: All evaluations are on-chain and verifiable

## Technology Stack

- **Frontend**: Next.js, React, TypeScript
- **Blockchain**: GenLayer Intelligent Contracts
- **AI/ML**: LLM integration via GenLayer validators
- **Storage**: Redis for temporary data
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- Access to GenLayer testnet/mainnet
- Redis instance (for caching)

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run development server
pnpm dev
```

## Project Structure

```
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── analyze-image/ # Image analysis endpoint
│   │   ├── upload-image/  # Image upload endpoint
│   │   └── leaderboard/   # Leaderboard endpoints
│   └── page.tsx           # Main page
├── components/            # React components
│   ├── argentinean-experience-screen.tsx
│   └── leaderboard.tsx
├── contracts/             # GenLayer Intelligent Contracts
│   └── proof_of_argentinean_experience.py
└── lib/                   # Utilities and contract bindings
    └── contracts/
        └── proof-of-argentinean-experience.ts
```

## How It Works

1. **Upload**: User uploads a photo of an Argentinean cultural experience
2. **Analysis**: The image is analyzed and a description is generated
3. **Evaluation**: GenLayer validators evaluate the cultural authenticity (0-100 score)
4. **Consensus**: Multiple validators reach consensus on the score
5. **Ranking**: Photos are ranked in leaderboards by category
6. **Dispute Resolution**: If needed, disputes can be resolved through GenLayer's appeal process

## Learn More

- [GenLayer Website](https://www.genlayer.com/)
- [GenLayer Documentation](https://docs.genlayer.com/)
- [GenLayer Studio](https://studio.genlayer.com/) - Try Intelligent Contracts in your browser
- [GenLayer GitHub](https://github.com/genlayer)

## License

MIT
