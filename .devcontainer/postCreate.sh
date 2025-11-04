#!/bin/bash

set -e

echo "🚀 Setting up Personal Health Dashboard development environment..."

echo "📦 Configuring npm global directory..."
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'

export PATH=~/.npm-global/bin:$PATH
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc

echo "📿 Installing Wrangler CLI..."
npm install -g wrangler@latest

echo "📦 Installing project dependencies..."
npm install

echo "✅ Development environment setup complete!"